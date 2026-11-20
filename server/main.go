package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"ecosim/internal/config"
	"ecosim/internal/engine"
	"ecosim/internal/observe"
)

const maxSessions = 32

var sessionID = regexp.MustCompile(`^[0-9a-f]{32}$`)

type simulation struct {
	mu      sync.Mutex
	engine  *engine.Engine
	touched time.Time // guarded by the server's session lock
}

type server struct {
	cfg          *config.Root
	seed         uint64
	defaultWorld simulation
	mu           sync.Mutex
	sessions     map[string]*simulation
}

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	cfgDir := flag.String("cfg", "cfg", "simulation configuration directory")
	seed := flag.Uint64("seed", 0, "initial seed (0 uses balance.json)")
	client := flag.String("client", "client", "client asset directory")
	flag.Parse()
	cfg, err := config.LoadDir(*cfgDir)
	if err != nil {
		log.Fatal(err)
	}
	if *seed == 0 {
		*seed = uint64(cfg.Balance.World.Seed)
	}
	s := &server{cfg: cfg, seed: *seed, sessions: make(map[string]*simulation)}
	mux := http.NewServeMux()
	for _, command := range []string{"state", "step", "run", "reset"} {
		mux.HandleFunc("/api/"+command, s.serveAPI)
	}
	mux.Handle("/", http.FileServer(http.Dir(*client)))
	log.Printf("SimulationWorld listening at %s (seed=%d)", *addr, *seed)
	log.Fatal(http.ListenAndServe(*addr, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		mux.ServeHTTP(w, r)
	})))
}

func (s *server) world(id string) *simulation {
	if id == "" {
		return &s.defaultWorld
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	world := s.sessions[id]
	if world == nil {
		// Browser checkpoints can restore worlds that have fallen out of the cache.
		if len(s.sessions) == maxSessions {
			var oldestID string
			var oldest time.Time
			for key, candidate := range s.sessions {
				if oldestID == "" || candidate.touched.Before(oldest) {
					oldestID, oldest = key, candidate.touched
				}
			}
			delete(s.sessions, oldestID)
		}
		world = &simulation{}
		s.sessions[id] = world
	}
	world.touched = time.Now()
	return world
}

func (s *server) serveAPI(w http.ResponseWriter, r *http.Request) {
	command := strings.TrimPrefix(r.URL.Path, "/api/")
	if (command == "state" && r.Method != http.MethodGet) ||
		(command != "state" && r.Method != http.MethodPost) {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := r.Header.Get("X-Simulation-Session")
	if id != "" && !sessionID.MatchString(id) {
		http.Error(w, "invalid session ID", http.StatusBadRequest)
		return
	}

	ticks, resetSeed := 1, uint64(s.cfg.Balance.World.Seed)
	switch command {
	case "run":
		if value := r.URL.Query().Get("n"); value != "" {
			n, err := strconv.Atoi(value)
			if err != nil || n < 0 {
				http.Error(w, "invalid n", http.StatusBadRequest)
				return
			}
			ticks = n
		}
	case "reset":
		if value := r.URL.Query().Get("seed"); value != "" {
			seed, err := strconv.ParseUint(value, 10, 64)
			if err != nil {
				http.Error(w, "invalid seed", http.StatusBadRequest)
				return
			}
			resetSeed = seed
		}
	}

	seed, resumeTick := s.seed, 0
	if checkpoint := r.Header.Get("X-Simulation-Checkpoint"); id != "" && checkpoint != "" {
		seedText, tickText, ok := strings.Cut(checkpoint, ":")
		parsedSeed, seedErr := strconv.ParseUint(seedText, 10, 64)
		parsedTick, tickErr := strconv.Atoi(tickText)
		if !ok || seedErr != nil || tickErr != nil || parsedTick < 0 {
			http.Error(w, "invalid checkpoint", http.StatusBadRequest)
			return
		}
		seed, resumeTick = parsedSeed, parsedTick
	}

	world := s.world(id)
	snapshot, err := s.apply(r.Context(), world, command, seed, resumeTick, resetSeed, ticks)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	var result any = snapshot
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, context.DeadlineExceeded) {
			status = http.StatusServiceUnavailable
		}
		w.WriteHeader(status)
		result = map[string]any{"error": err.Error(), "snapshot": snapshot}
	}
	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Printf("write snapshot: %v", err)
	}
}

func (s *server) apply(ctx context.Context, world *simulation, command string, seed uint64, resumeTick int, resetSeed uint64, ticks int) (*observe.Snapshot, error) {
	world.mu.Lock()
	defer world.mu.Unlock()
	if command == "reset" {
		world.engine = engine.New(s.cfg, engine.Options{Seed: resetSeed})
	} else if world.engine == nil {
		e := engine.New(s.cfg, engine.Options{Seed: seed})
		// shortcut: restore by replaying confirmed steps; use saved engine checkpoints if long replays become common.
		restore, cancel := context.WithTimeout(ctx, 20*time.Second)
		defer cancel()
		if err := e.Run(resumeTick, func(*engine.Engine) error { return restore.Err() }); err != nil {
			return nil, err
		}
		world.engine = e
	}
	var err error
	if command == "run" || command == "step" {
		err = world.engine.Run(ticks, nil)
	}
	return world.engine.Snapshot(200, 2000), err
}
