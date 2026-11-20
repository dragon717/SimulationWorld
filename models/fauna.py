"""Terai fauna in metres. Each root is also exported as a reusable local-space GLB."""
import math
from mathutils import Vector
from forms import Form, group, sway
from pelt import continuous_coat

INK = '302c28'
IVORY = 'f2ddaf'
EYE = 'b57c37'


def torso(name, parent, rings, coat):
    f = Form()
    f.loft([(x,0,z,w,h) for x,z,w,h in rings], 'ffffff', 40)
    return f.finish(name, parent, coat, True)


def ear(f, at, side, length, width, fur, inner):
    x,y,z = at
    path = [(x,y,z), (x-.035,y+side*length*.44,z+length*.49),
            (x-.062,y+side*length*.76,z+length*.82), (x-.069,y+side*length*.82,z+length*.9)]
    f.tube(path, [(.026,width*.65),(.045,width),(.03,width*.65),.008], fur, 12)
    a,b,c = path[:3]
    f.leaf((a[0]+.03,a[1],a[2]),(c[0]-a[0]+.005,c[1]-a[1],c[2]-a[2]),
           (0,side*width*.39,-width*.41),.009,inner)



def pelt_limb(skin, path, radii, offset):
    """Round the shoulder into the torso and carry its coat down to the ankle."""
    pts=[Vector(p) for p in path]
    curve=[]; sizes=[]
    for i in range(len(pts)-1):
        a,b,c,d=pts[max(0,i-1)],pts[i],pts[i+1],pts[min(i+2,len(pts)-1)]
        for t in (0,.333,.667):
            curve.append(.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t**3))
            sizes.append(radii[i]*(1-t)+radii[i+1]*t)
    curve.append(pts[-1]); sizes.append(radii[-1])
    start=len(skin.verts); sides=18
    skin.tube(curve,sizes,'ffffff',sides)
    distances=[0.]
    for a,b in zip(curve,curve[1:]):
        distances.append(distances[-1]+(b-a).length)
    outward=1 if pts[0].y>0 else -1
    for i in range(len(curve)):
        t=distances[i]/distances[-1]
        for j in range(sides):
            index=start+i*sides+j
            angle=math.tau*j/sides
            # Project across the transported ring so stripe folds stay away from the outer flank.
            u=.46+.20*offset+.41*math.cos(angle)+.10*outward*math.sin(angle)
            skin.uvs[index]=(u,.98-.95*t)


def skull_surface(rings, side, x, angle, lift):
    a,b=next((a,b) for a,b in zip(rings,rings[1:]) if a[0]<=x<=b[0])
    t=(x-a[0])/(b[0]-a[0])
    z,w,h=[a[k]*(1-t)+b[k]*t for k in (2,3,4)]
    return x,side*(w+lift)*math.sin(angle),z+(h+lift)*math.cos(angle)


def fur_patch(form, first, rect):
    """Place a soft part on a selected color region of the species' albedo."""
    points = form.verts[first:]
    xmin, xmax = min(p[0] for p in points), max(p[0] for p in points)
    zmin, zmax = min(p[2] for p in points), max(p[2] for p in points)
    u0, v0, u1, v1 = rect
    for i, (x, _, z) in enumerate(points, first):
        uv = form.uvs[i]
        if uv is None:
            uv = ((x-xmin)/max(xmax-xmin, .0001), (z-zmin)/max(zmax-zmin, .0001))
        form.uvs[i] = (u0+(u1-u0)*uv[0], v0+(v1-v0)*uv[1])


def orbital_coat(face, skull, side):
    """Fade the dark eyelid into the same fur coordinates as the surrounding cheek."""
    edge = None
    for radius, tint, lift in ((.44,'48352d',.009),(.72,'625042',.006),(1.,'ffffff',.002)):
        ring = []
        for i in range(32):
            a=math.tau*i/32
            x=.390+radius*.055*math.cos(a)
            theta=1.22+radius*(.154*math.sin(a)-.044*math.cos(a))
            segment=next(j for j in range(len(skull)-1) if skull[j][0] <= x <= skull[j+1][0])
            t=(x-skull[segment][0])/(skull[segment+1][0]-skull[segment][0])
            uv=(.012+.976*(segment+t)/(len(skull)-1), .018+.964*(.5+.98*(.5-theta/math.pi)))
            ring.append(face.point(skull_surface(skull,side,x,theta,lift),tint,uv))
        if edge is None:
            face.face(ring if side>0 else reversed(ring))
        else:
            for i in range(len(ring)):
                quad=(edge[i-1],ring[i-1],ring[i],edge[i])
                face.face(quad if side>0 else reversed(quad))
        edge=ring


def eye_patch(form,rings,side,x,angle,rx,ra,tint,lift):
    center=form.point(skull_surface(rings,side,x,angle,lift+.002),tint)
    edge=[]
    for i in range(24):
        a=i*math.tau/24
        xx=x+rx*math.cos(a)
        theta=angle+ra*math.sin(a)-.045*math.cos(a)
        edge.append(form.point(skull_surface(rings,side,xx,theta,lift),tint))
    for i in range(len(edge)):
        form.face((center,edge[i-1],edge[i]))


def chital(label, paint, coat, leg_coat, head_coat, antlers=True):
    root=group(label)
    body = [(-.80,.89,.025,.07),(-.75,.91,.15,.20),(-.59,.93,.245,.30),
            (-.36,.94,.265,.318),(-.12,.95,.24,.285),(.15,.96,.235,.29),
            (.37,.965,.25,.323),(.50,1.0,.20,.30),(.57,1.04,.12,.21)]
    torso('Dappled flank',root,body,coat)
    hoof = '403b35'
    f,skin=Form(),Form()
    for s in (-1,1):
        # Slightly staggered feet show the hock and the cloven hoof in silhouette.
        shift=.07*s
        for rear in (False,True):
            x,y=(-.55 if rear else .38),s*.155
            if rear:
                leg=[(x,y,1.03),(x+.09,y+s*.032,.82),(x+.20,y+s*.025,.63),
                     (x-.02+shift,y,.38),(x-.05+shift,y,.32),(x+.018+shift,y,.105),(x+.055+shift,y,.055)]
                radii=[.153,.15,.086,.049,.043,.027,.032]
            else:
                leg=[(x,y,.99),(x+.045,y+s*.03,.78),(x-.015,y,.61),
                     (x+.03+shift,y,.45),(x+.024+shift,y,.38),(x+.05+shift,y,.10),(x+.09+shift,y,.05)]
                radii=[.115,.096,.062,.041,.034,.027,.031]
            leg[0]=(x,s*.085,1.095)
            radii[0]=.071
            pelt_limb(skin,leg,radii,.02 if rear else .25)
            for cleft in (-1,1):
                f.oval((leg[-1][0]+.016,y+cleft*.019,.043),(.059,.018,.038),hoof)
    f.tube([(-.71,0,1.04),(-.82,0,1.01),(-.90,.011,.91),(-.91,.02,.86)],[.06,.064,.045,.012],IVORY)
    skin.finish('Spotted shoulders and legs',root,leg_coat,True)
    f.finish('Cleft hooves and tail',root,paint,True)
    pivot=group('Chital neck',root,(.42,0,1.035))
    face, ears, jaw, features, rims = Form(), Form(), Form(), Form(), Form()
    face.tube([(0,0,0),(.07,0,.15),(.15,0,.29),(.22,0,.42),(.25,0,.48)],
              [(.175,.155),(.163,.14),(.129,.113),(.10,.09),(.095,.092)],'ffffff',22)
    face.tube([(.085,0,.045),(.18,0,.21),(.265,0,.37)], [.086,.071,.04],'ffffff')
    skull=[(.14,0,.49,.03,.064),(.18,0,.51,.102,.118),(.26,0,.52,.119,.135),
               (.33,0,.505,.10,.121),(.40,0,.48,.078,.085),(.48,0,.455,.061,.055),
               (.50,0,.45,.049,.04)]
    face.loft(skull,'ffffff')
    jaw.oval((.471,0,.428),(.049,.057,.037),'ffffff')
    fur_patch(jaw,0,(.68,.012,.98,.19))
    features.oval((.494,0,.467),(.034,.061,.031),INK)
    for s in (-1,1):
        first=len(ears.verts)
        ear(ears,(.203,s*.073,.586),s,.227,.066,'c99d78','eed4b1')
        fur_patch(ears,first,(.63,.025,.98,.40))
        first=len(rims.verts)
        rims.oval((.30,s*.103,.545),(.033,.015,.025),'edd5ae')
        fur_patch(rims,first,(.67,.10,.93,.27))
        features.oval((.308,s*.111,.55),(.028,.014,.018),INK)
        features.oval((.317,s*.123,.556),(.006,.003,.005),'f4e8d4',8,4)
        if antlers:
            horn='846b4e'
            path=[(.212,s*.067,.612),(.17,s*.084,.70),(.09,s*.112,.81),
                  (-.015,s*.17,.945),(-.06,s*.22,1.047),(-.035,s*.245,1.13)]
            features.tube(path,[.032,.032,.028,.023,.015,.003],horn,10)
            features.tube([path[1],(.226,s*.10,.79),(.24,s*.104,.866)],[.023,.014,.002],horn)
            features.tube([path[3],(.043,s*.174,1.028),(.067,s*.177,1.084)],[.020,.011,.002],horn)
    face.finish('Neck, muzzle and cheeks',pivot,head_coat,True)
    ears.finish('Furred ears',pivot,head_coat,True)
    jaw.finish('Furred jaw',pivot,head_coat,True)
    rims.finish('Furred eye rims',pivot,head_coat,True)
    features.finish('Facial details',pivot,paint,True)
    continuous_coat(root,body,skull,False)
    sway(pivot,1,[0,5,12,4,0] if antlers else [40,49,52,44,40])
    return root


def tiger(paint, coat, leg_coat, head_coat):
    root=group('Bengal tiger')
    fur, dark='c47c3a','322b27'
    body=[(-1.0,.825,.06,.09),(-.90,.86,.205,.26),(-.70,.87,.295,.35),(-.45,.865,.285,.347),
          (-.18,.87,.255,.285),(.10,.88,.28,.32),(.35,.89,.32,.368),
          (.55,.90,.31,.37),(.72,.92,.235,.28),(.81,.94,.166,.19)]
    torso('Striped torso',root,body,coat)
    f,skin=Form(),Form()
    for s in (-1,1):
        offset=.105*s
        for rear in (True,False):
            x,y=(-.71 if rear else .53),s*.209
            if rear:
                leg=[(x,y,.98),(x+.05,y+s*.024,.78),(x+.21,y,.55),
                     (x+.19,y,.47),(x-.10+offset,y,.268),(x-.11+offset,y,.216),(x-.063+offset,y,.115)]
                widths=[.157,.175,.13,.116,.071,.067,.066]
            else:
                leg=[(x,y,.99),(x-.02,y+s*.02,.77),(x-.115,y,.56),(x-.10,y,.49),
                     (x+.035+offset,y,.27),(x+.03+offset,y,.147),(x+.065+offset,y,.105)]
                widths=[.169,.153,.115,.099,.076,.068,.068]
            leg[0]=(x,s*.11,1.09)
            widths[0]=.081
            pelt_limb(skin,leg,widths,.04 if rear else .25)
            px,py,_=leg[-1]
            f.oval((px+.048,py,.078),(.134,.09,.072),'ffffff')
            for toe in (-1,0,1):
                f.oval((px+.135-abs(toe)*.012,py+toe*.048,.052),(.058,.032,.042),'ffffff')
    skin.finish('Striped shoulders and hocks',root,leg_coat,True)
    f.finish('Paws',root,leg_coat,True)
    head=group('Tiger head',root,(.62,0,.957))
    face, ears, jaw, features, rims = Form(), Form(), Form(), Form(), Form()
    skull=[(-.06,0,-.01,.11,.13),(.01,0,.015,.215,.209),(.15,0,.065,.247,.23),
           (.26,0,.082,.26,.226),(.37,0,.071,.23,.198),(.44,0,.045,.174,.141),
           (.51,0,.017,.09,.086)]
    face.loft(skull,'ffffff',48)
    jaw.oval((.409,0,-.054),(.144,.143,.093),'ffffff')
    fur_patch(jaw,0,(.71,.012,.98,.16))
    for s in (-1,1):
        first=len(ears.verts)
        ears.oval((.14,s*.158,.244),(.078,.076,.099),'403831')
        ears.oval((.178,s*.19,.253),(.055,.046,.067),'c59c7f')
        ears.oval((.08,s*.169,.267),(.018,.039,.037),'fff4e6')
        fur_patch(ears,first,(.74,.015,.98,.21))
        face.tube([(.20,s*.195,.05),(.213,s*.245,-.015),(.175,s*.249,-.097)],
                  [.078,.067,.012],'fff1db')
        orbital_coat(rims,skull,s)
        eye_patch(features,skull,s,.393,1.22,.024,.091,'bc893f',.014)
        eye_patch(features,skull,s,.398,1.22,.012,.073,INK,.018)
        eye_patch(features,skull,s,.403,1.19,.0035,.020,'f5e2b8',.021)
        face.oval((.483,s*.082,.003),(.096,.093,.062),'ffffff')
        for i in range(8):
            dx=(i%4-1.3)*.018; dz=(i//4-.4)*.019
            py=.082+.093*math.sqrt(1-(dx/.096)**2-(dz/.062)**2)
            base=Vector((.483+dx,s*py,.003+dz))
            features.oval(base,(.005,.003,.004),dark,8,4)
            reach=Vector((.018+dx*1.8,s*(.13+.012*(i%4)),dz*2-.010))
            features.tube([base,base+reach*.52+Vector((.014,0,.006)),base+reach],
                          [.0018,.0011,.00025],'d6c7a6',5)
        features.tube([(.477,s*.032,.084),(.429,s*.072,.121),(.396,s*.109,.153)],[.006,.013,.004],dark)
    features.oval((.536,0,.05),(.060,.080,.045),'704b40')
    face.finish('Masked face and whisker pads',head,head_coat,True)
    ears.finish('Furred ears',head,head_coat,True)
    jaw.finish('Furred jaw',head,head_coat,True)
    rims.finish('Furred eye rims',head,head_coat,True)
    features.finish('Facial details',head,paint,True)
    continuous_coat(root,body,skull,True)
    sway(head,2,[0,-4,0,4,0])
    tail=group('Tiger tail',root,(-.89,.025,.91))
    f=Form()
    path=[(0,0,0),(-.17,.018,-.11),(-.29,.044,-.29),(-.43,.07,-.45),
          (-.58,.12,-.50),(-.72,.22,-.46),(-.83,.28,-.36),(-.89,.29,-.24)]
    widths=[.089,.080,.072,.068,.061,.055,.049,.035]
    # Adjacent segments share a cross-section, so the dark hair bands do not float.
    for i,(p,q) in enumerate(zip(path,path[1:])):
        a,b=Vector(p),Vector(q)
        mid=a.lerp(b,.63)
        r=widths[i]*.37+widths[i+1]*.63
        f.tube([a,mid],[widths[i],r],fur if i<6 else dark,16)
        f.tube([mid,b],[r,widths[i+1]],dark,16)
    f.oval(path[-1],(.036,.035,.045),dark)
    f.finish('Ringed tail',tail,paint,True)
    sway(tail,2,[0,12,0,-12,0])
    return root


def mugger(paint, coat):
    root=group('Marsh mugger')
    olive, dark, gold='696b50','444e42','9b9870'
    body=[(-.93,.28,.10,.105),(-.81,.32,.24,.166),(-.55,.34,.345,.21),
          (-.22,.35,.38,.25),(.15,.355,.37,.245),(.43,.345,.315,.213),
          (.65,.335,.235,.163),(.76,.32,.20,.136)]
    torso('Armoured trunk',root,body,coat)
    f=Form()
    for i in range(15):
        x=-.81+i*.091
        # Sample the trunk profile so the scutes follow its actual surface.
        a,b=next((a,b) for a,b in zip(body,body[1:]) if a[0]<=x<=b[0])
        t=(x-a[0])/(b[0]-a[0]); z,w,h=[a[k]*(1-t)+b[k]*t for k in (1,2,3)]
        for j in (-.69,-.27,.27,.69):
            y=w*j; top=z+h*math.sqrt(1-j*j)
            f.tube([(x-.061,y,top-.004),(x-.022,y,top+.022),(x+.046,y,top-.003)],
                   [(.014,.032),(.034,.046),(.008,.028)], gold if (i+int(j*10))%5==0 else olive,6)
    for s in (-1,1):
        for x,sign in [(-.61,-1),(.43,1)]:
            p=(x,s*.249,.297); knee=(x+sign*.16,s*.427,.209)
            ankle=(x+sign*.04,s*.52,.077); foot=(x+sign*.155,s*.63,.045)
            f.tube([p,knee,ankle,foot],[.096,.082,.050,.035],olive,12)
            for j in range(4):
                f.tube([foot,(foot[0]+(j-1.5)*.052,foot[1]+s*(.11-abs(j-1.5)*.019),.019)],[.018,.003],dark,7)
    f.finish('Osteoderms and splayed feet',root,paint,True)
    tail=group('Mugger tail',root,(-.81,0,.30))
    f=Form()
    points=[(0,0,0),(-.21,-.01,-.036),(-.41,-.05,-.073),(-.64,-.12,-.121),
            (-.88,-.207,-.17),(-1.11,-.265,-.207),(-1.32,-.232,-.23),(-1.52,-.14,-.24)]
    widths=[(.167,.224),(.141,.183),(.132,.138),(.114,.101),(.088,.073),(.058,.05),(.039,.026),(.009,.008)]
    skin=Form()
    skin.tube(points,widths,'ffffff',20)
    for i in range(len(points)):
        for j in range(20):
            skin.uvs[i*20+j]=(.66-i*.067,.38+.25*math.cos(math.tau*j/20))
    skin.finish('Scaled tail',tail,coat,True)
    for i,(a,b) in enumerate(zip(points,points[1:])):
        for t in (.12,.55):
            x,y,z=[a[j]+(b[j]-a[j])*t for j in range(3)]
            r=widths[i][0]*(1-t)+widths[i+1][0]*t
            for s in ((-1,1) if i<3 else (0,)):
                f.tube([(x,y+s*r*.43,z+r*.79),(x-.025,y+s*r*.50,z+r*1.29),(x-.044,y+s*r*.53,z+r*1.48)],
                       [(.039,.025),(.028,.014),.003],dark,6)
    f.finish('Tapered crested tail',tail,paint,True)
    sway(tail,2,[0,3,1,-3,0])
    f=Form()
    snout=Form()
    snout.loft([(.60,0,.317,.165,.101),(.75,0,.345,.235,.154),(.90,0,.348,.236,.151),
            (1.04,0,.324,.204,.11),(1.19,0,.29,.154,.073),(1.37,0,.282,.137,.059),
            (1.465,0,.289,.126,.066),(1.51,0,.284,.073,.048)],'ffffff',32)
    snout.uvs=[(.24+.30*u,.30+.42*v) for u,v in snout.uvs]
    snout.finish('Broad scaled snout',root,coat,True)
    for s in (-1,1):
        f.oval((.965,s*.151,.441),(.105,.069,.065),olive)
        f.oval((.982,s*.192,.461),(.052,.037,.027),'b8a665')
        f.oval((.988,s*.220,.464),(.009,.007,.022),INK)
        f.oval((1.441,s*.079,.338),(.037,.022,.009),dark)
        for i in range(10):
            x=1.035+i*.046; y=s*(.187-.06*min(1,i/5))
            f.tube([(x,y,.264),(x+.002,y,.246-(i%3)*.004)], [.009,.001],'d2c894',8)
    f.finish('Broad snout, nostrils and eyes',root,paint,True)
    jaw=group('Mugger jaw',root,(.72,0,.252))
    f=Form()
    f.loft([(-.02,0,-.008,.13,.047),(.12,0,-.013,.191,.055),(.29,0,-.018,.186,.045),
            (.49,0,-.013,.138,.040),(.68,0,-.006,.126,.033),(.764,0,.010,.085,.019)],'aca785')
    f.finish('Lower jaw',jaw,paint,True)
    sway(jaw,1,[0,1,4,2,0])
    return root
