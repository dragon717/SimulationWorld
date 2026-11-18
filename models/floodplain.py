"""A continuous section of alluvial bank, channel and backshore, in metres."""
import math
import random

from mathutils import Vector
from forms import Form, group

rng = random.Random(284)
sin, cos = math.sin, math.cos
HALF_X = 9


def limit(x):
    return 6.4-1.8*(abs(x)/HALF_X)**6


def channel(x):
    return -.46 + 1.04*sin(x*.42+.35) + x*.125


def width(x):
    return 1.32 + .22*cos(x*.65) + .24*cos(x*.27+1.5)


def shore(x,y):
    return abs(y-channel(x))-width(x)


def height(x,y):
    d=shore(x,y)
    if d<0:
        return -.025-.44*min(1,-d/.75)
    undulation=.12*sin(.85*x+.23*y)+.08*sin(.69*y-.55*x)+.055*cos(1.4*x+1.9*y)
    return -.025 + (1-math.exp(-d*.85))*(.63+.10*y+undulation)


def mix(a,b,t):
    t=max(0,min(1,t))
    return bytes(round(x*(1-t)+y*t) for x,y in zip(bytes.fromhex(a),bytes.fromhex(b))).hex()


def ground(root, paint, water_mat):
    bed,water,cut,glints=Form(),Form(),Form(),Form()
    sections=[]
    n=124
    for i in range(n+1):
        x=(i/n*2-1)*HALF_X
        edge=limit(x); river=channel(x); w=width(x)
        guides=[(-edge,0),(river-w,21),(river+w,13),(edge,27)]
        ys=[-edge]
        for (lo,_),(hi,num) in zip(guides,guides[1:]):
            ys.extend(lo+(hi-lo)*j/num for j in range(1,num+1))
        row=[]
        for j,y in enumerate(ys):
            d=shore(x,y); z=height(x,y)
            noise=sin(2.01*x+.48*y)*.18+sin(3.77*y+x*.36)*.13+cos(x*1.15-y*1.9)*.21
            sand=mix('bbaa83','dacc9e',.53+noise)
            grass=mix('718356','a7ac75',.51+noise)
            color=mix(sand,grass,(d-.33)*1.14+noise*.4)
            row.append(bed.point((x,y,z),color))
            if i and j:
                a,b=sections[-1][j-1],sections[-1][j]
                bed.face((a,row[-2],row[-1],b))
        sections.append(row)
        # The strip is seated in the same cut bank as the bed, with deeper jade in the thalweg.
        for j in range(17):
            v=j/16; y=river+(v*2-1)*(w+.04)
            deep=sin(math.pi*v)**.65
            tint=mix('aec1a1','417d78',deep*(.83+.10*sin(x*.9+v*4)))
            idx=water.point((x,y,.003+.0025*sin(x*2+v*8)*deep),tint)
            if i and j:
                water.face((idx-18,idx-1,idx,idx-17))
    bed.finish('Floodplain ground and riverbed',root,paint,True)
    water.finish('Jade channel',root,water_mat,True)
    border=sections[0]+[s[-1] for s in sections[1:]]+list(reversed(sections[-1][:-1]))+[s[0] for s in reversed(sections[1:-1])]
    for i,idx in enumerate(border):
        x,y,z=bed.verts[idx]
        next_x,next_y,next_z=bed.verts[border[(i+1)%len(border)]]
        def levels(x,y,z):
            wave=.026*sin(2*x+y)+.028*cos(x-y*.71)
            return (z,-.54+wave,-.64+wave,-.81+wave*.8,-1.01+wave*.6,-1.11+wave*.45,-1.30)
        za,zb=levels(x,y,z),levels(next_x,next_y,next_z)
        for j,(top,base) in enumerate(zip(za,za[1:])):
            tint=['9c896d','c5a97e','a18d73','847a64','a89977','716e5b'][j]
            cut.face([cut.point(v,tint) for v in ((x,y,top),(next_x,next_y,zb[j]),(next_x,next_y,zb[j+1]),(x,y,base))])
    cut.face([cut.point((*bed.verts[idx][:2],-1.30),'716e5b') for idx in border])
    cut.finish('Alluvial cut · silt, sand and gravel',root,paint)
    for i in range(490):
        x=rng.uniform(-8.8,8.8); w=width(x); offset=rng.uniform(-w*.96,w*.96); y=channel(x)+offset
        reach=rng.uniform(.06,.41)*(1.15 if abs(offset)>w*.7 else .88)
        dy=.125+.437*cos(x*.42+.35)
        color=rng.choice(['9bbcb0','80a9a0','b6cbb6','6a9a93'])
        glints.leaf((x,y,.011),(reach,dy*reach,.001),(-dy*.004,rng.uniform(.004,.014),0),.0005,color)
    glints.finish('Fine surface currents',root,paint)


def sal_tree(root,x,y,h,paint):
    tree=group('Sal · broadleaf',root,(x,y,height(x,y)-.03))
    f,leaves=Form(),Form()
    s=h/4.8
    bark='70654e'; lit='89795a'
    def pt(x,y,z):
        return Vector((x*s,y*s,z*s))
    def branch(pts,r,color):
        f.tube(pts,[v*s for v in r],color,10)
    centers=[pt(0,0,0),pt(.01,-.03,.29),pt(-.12,-.015,1.24),pt(-.19,.04,2.15),pt(-.10,.09,2.96),pt(.14,.08,3.77),pt(.20,.09,4.12)]
    branch(centers,[.28,.201,.143,.115,.085,.05,.019],bark)
    for i in range(7):
        a=i*math.tau/7
        branch([pt(cos(a)*.51,sin(a)*.51,-.036),pt(cos(a)*.19,sin(a)*.19,.09),centers[1]],
               [.016,.093,.101],lit if i%3==0 else bark)
    hues=['486852','577655','698558','79925d','8c9e64','627e57','a3a86b','758f66']
    for j in range(13):
        a=j*2.399+rng.uniform(-.20,.20)
        h0=1.60+j*.157
        reach=(1.39-.048*j)*rng.uniform(.8,1.18)
        start=pt(-.12,.06,h0)
        elbow=start+pt(cos(a)*reach*.53,sin(a)*reach*.53,.36)
        end=start+pt(cos(a)*reach,sin(a)*reach,.69+rng.random()*.21)
        branch([start,elbow,end],[.075-j*.0025,.044,.020],bark)
        for k in range(5):
            az=a+(k-2)*.47
            tip=end+pt(cos(az)*rng.uniform(.22,.60),sin(az)*rng.uniform(.22,.60),rng.uniform(.14,.49))
            branch([elbow.lerp(end,.55),end.lerp(tip,.50),tip],[.031,.020,.008],lit)
            for m in range(20):
                theta=rng.random()*math.tau; rad=rng.random()**.55*.48*s
                v=tip+Vector((cos(theta)*rad,sin(theta)*rad,rng.uniform(-.13,.17)*s))
                az=theta+rng.uniform(-.7,.7); length=rng.uniform(.19,.42)*s
                leaves.leaf(v,(cos(az)*length,sin(az)*length,rng.uniform(-.19,.12)*s),
                            (-sin(az)*length*.35,cos(az)*length*.35,.028*s),.053*s,rng.choice(hues))
    f.finish('Sal · roots and boughs',tree,paint,True)
    leaves.finish('Sal · folded leaves',tree,paint)


def vegetation(root,paint,clearings):
    herbs,reeds,stones=Form(),Form(),Form()
    for i in range(5500):
        x=rng.uniform(-8.92,8.92); y=rng.uniform(-limit(x)+.1,limit(x)-.1)
        d=shore(x,y)
        if d<.36 or any((x-a)**2+(y-b)**2<r*r for a,b,r in clearings):
            continue
        patch=.5*sin(x*1.67+y*.59)+.31*cos(y*2.48-x*.4)+.19*sin(y*3.0+x*1.1)
        if patch<-.16 and rng.random()<.83:
            continue
        z=height(x,y)-.016
        tall=.6<d<1.55 and patch>.23
        size=rng.uniform(.12,.30)* (1.55 if tall else 1)
        for j in range(rng.randint(5,10)):
            a=rng.random()*math.tau; h=size*rng.uniform(.51,1.14); reach=h*rng.uniform(.3,.88)
            tint=rng.choice(['788754','8f9c63','a0aa6c','657d55','acb279','b1ad74'])
            herbs.leaf((x+.028*cos(a),y+.028*sin(a),z),(reach*cos(a),reach*sin(a),h),
                       (-sin(a)*h*.088,cos(a)*h*.088,.014),h*.19,tint)
        if tall and rng.random()<.40:
            for j in range(3):
                a=rng.random()*math.tau; h=rng.uniform(.33,.69)
                stem=Vector((x,y,z)); top=stem+Vector((cos(a)*.15,sin(a)*.15,h))
                reeds.tube([stem,top],[.009,.005],'9a9464',5)
                reeds.tube([top,top+Vector((.027,.014,.073)),top+Vector((.052,.024,.161))],
                           [.006,.023,.002],rng.choice(['cdc49a','dbcea5','c0b58c']),6)
    herbs.finish('Grassland · blades',root,paint)
    if reeds.verts:
        reeds.finish('Kans grass · plumes',root,paint)
    for i in range(470):
        x=rng.uniform(-8.9,8.9); s=rng.choice((-1,1)); d=rng.uniform(-.15,.67)
        y=channel(x)+s*(width(x)+d); z=height(x,y)
        if any((x-a)**2+(y-b)**2<(r*.6)**2 for a,b,r in clearings):
            continue
        r=rng.uniform(.023,.102)*(2.4 if i%27==0 else 1)
        stones.oval((x,y,z+.014),(r*1.4,r*.72,r*.49),rng.choice(['9b9a83','848d7d','a9a18b','b8ae95','777f70']),8,4)
    stones.finish('Gravel bars',root,paint,True)


def habitat(paint,water_mat,clearings):
    root=group('Rapti floodplain')
    ground(root,paint,water_mat)
    vegetation(root,paint,clearings)
    for x,y,h in [(-6.5,3.9,4.6),(-4.6,4.9,4.0),(-7.85,1.75,3.4),(-2.6,5.7,3.8),
                  (4.85,4.88,4.15),(6.88,4.15,4.8),(7.8,2.35,3.2)]:
        sal_tree(root,x,y,h,paint)
    return root
