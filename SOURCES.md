# 拉普蒂河漫滩的参考来源

## 场景为何选奇特旺

奇特旺位于喜马拉雅山麓的特莱低地。拉普蒂河沿公园北侧流过，河岸林、冲积草地和以娑罗树为主的林区在当地相接。模型把这三类环境压缩在一段约 18 米宽的展示地块上。河道的弯曲、动物间距与镜头构图是本作设计。[联合国教科文组织 · 奇特旺国家公园](https://whc.unesco.org/en/list/284/)

公园管理计划把林草交界带列为花鹿常见的环境，并记载沼泽鳄与湿地的关系。尼泊尔国家自然保护信托的相机调查收录了奇特旺的花鹿与孟加拉虎，河流监测也记录了当地的沼泽鳄。场景据此将鹿放在草岸、虎放在林缘、鳄放在浅水。它们的位置共同展示栖息地分区。[公园管理计划](https://chitwannationalpark.gov.np/index.php/reports/publications?download=43%3Amanagement-plan-printed) · [奇特旺哺乳动物相机调查](https://www.ntnc.org.np/publication/mammals-chitwan-national-park-and-its-surroundings-account-camera-trap-survey) · [奇特旺与巴迪亚的鳄类监测](https://ntnc.org.np/newsletter/crocodile-monitoring-chitwan-and-bardia)

## 动物外形

- **花鹿**　选择 *Axis axis* 对应模拟器中的鹿。体侧白斑纵向成列，雄鹿角分三个尖，雌鹿也保留斑点。建模时分别处理躯干、细腿、分趾蹄和鹿角。[密歇根大学 Animal Diversity Web · 花鹿](https://animaldiversity.org/accounts/Axis_axis/)
- **孟加拉虎**　亚种取自奇特旺调查。用赭橙色底毛和收尖的深色条纹表现体侧，浅色口鼻与黑色耳背形成头部轮廓。[奇特旺国家公园哺乳动物图录](https://ntnc.org.np/sites/default/files/doc_publication/2024-08/Mammals_of_CNP_2024.pdf) · [圣迭戈动物园 · 虎的被毛](https://animals.sandiegozoo.org/animals/tiger) · [史密森尼国家动物园 · 虎的体貌](https://nationalzoo.si.edu/animals/tiger)
- **沼泽鳄**　选择 *Crocodylus palustris*。宽而钝的吻部、顶部眼鼻、隆起背鳞和长尾是建模时保留的识别点。[尼泊尔国家自然保护信托 · 沼泽鳄](https://ntnc.org.np/newsletter/crocodile-monitoring-chitwan-and-bardia) · [物种资料与吻部形态](https://crocodilian.com/cnhc/csp_cpal.htm) · [印度拉贾斯坦邦林业部门 · 两栖爬行动物图录](https://environment.rajasthan.gov.in/content/dam/raj/forest/ForestDepartment/PDFs/Preliminary-Birds-guide-/Reptiles%20%26%20Amphibians%20book%20of%20MHTR0.pdf)

## 两个项目各提供了什么

- **HryYyR/SimulationWorld**　核对版本 `d663d08b13237c4cc53c3a8ba36468cf6aa30f01`。生态设计定义“草 → 鹿 → 虎”；实际物种配置还有鳄，鹿的禁行地形和鳄的允许地形都指向河流。世界生成支持弯曲河道。实时模式直接编译该提交的 Go 服务，使用其物种配置、世界生成和演化快照。三维动物模型、贴图与展示程序在本仓库制作。[生态设计](https://github.com/HryYyR/SimulationWorld/blob/d663d08b13237c4cc53c3a8ba36468cf6aa30f01/SimulationWorld.md) · [物种配置](https://github.com/HryYyR/SimulationWorld/blob/d663d08b13237c4cc53c3a8ba36468cf6aa30f01/cfg/species.json) · [地形生成](https://github.com/HryYyR/SimulationWorld/blob/d663d08b13237c4cc53c3a8ba36468cf6aa30f01/internal/world/world.go)
- **《万物有应》**　本地核对 `297897d4b36d42429503e81f3ef5146ab58d2869` 的 `docs/美术资产.md`「入山」、`models/valley.py` 和客户端山谷视图。沿用青绿矿物设色、实体部件、分层植被、贴图随源码保存、Blender → GLB → Three.js，以及直接点选所见地表的做法。本作的娑罗树、河床和动物均按奇特旺另建。[项目仓库（访问权限随原项目）](https://github.com/dragon717/wanwuyouying)

## 材质与预览的制作来源

原始纹理用内置 ImageGen 生成，裁切为以下 JPEG。上述机构资料用于造型观察；仓库内的动物和景观预览均由实际 Blender 网格渲染。

| 生成内容 | 提示词要点 | 成品 |
| --- | --- | --- |
| 宣纸矿物底纹 | 正射微距、暖象牙白宣纸纤维、浅灰矿物沉积与淡墨洇边，低反差、均匀照明。以网格顶点颜色叠出草木、河水、沙滩的色差。 | [底纹](textures/pigment.jpg) |
| 三种动物的体表 | 三行横向材质图集，上行虎的赭橙短毛和收尖黑纹，中行花鹿的栗色与行列白斑，下行沼泽鳄的橄榄灰皮肤与盾鳞。 | [虎](textures/tiger.jpg) · [鹿](textures/chital.jpg) · [鳄](textures/mugger.jpg) |
| 花鹿与孟加拉虎的脸部 | 横向双层的平面短毛图集。每层从左侧太阳穴延伸到右侧吻端，顶部是额头，底部是浅色下颌。花鹿为栗色和浅褐色，虎为赭橙色、渐尖黑纹和乳白颊毛。眼球、鼻头和长须用现有模型单独绘制。每种动物取一层，分发为 1024 × 512 的底色贴图。 | [鹿头](textures/chital-head.jpg) · [虎头](textures/tiger-head.jpg) |
| 虎与鹿的四肢 | 两列纵向毛皮图，上端肩胯，下端蹄爪。鹿腿从肩部少量白斑过渡到棕褐和沙色短毛；虎腿有分叉的深色斜带，下端过渡至蜜色趾毛，内侧较浅。毛流沿关节向下，每种动物使用一张 512 × 1024 的底色贴图。 | [虎腿](textures/tiger-leg.jpg) · [鹿腿](textures/chital-leg.jpg) |

<details>
<summary>头脸和四肢贴图的生成提示词</summary>

**头脸图集**

Produce one square PBR BASE COLOR texture atlas for an animal 3D game, precisely two equal horizontal bands that occupy the entire square, NO border or line between them. Each band is ONE flat rectangular (2:1) seamless-looking photographic swatch of facial pelage, not a portrait. Fully filled from edge to edge, orthographic macro scan, flat albedo with no shadows or highlights, rich varied hair tufts clearly resolved in diffuse color. Both strips go from rear temple on LEFT to bridge of muzzle on RIGHT, crown at TOP, cheek/chin at BOTTOM. Hair tips sweep mostly left and slightly downward, with radiating fans of shorter hair in the muzzle area. TOP HALF ONLY = adult South Asian chital deer head coat, warm chestnut tawny brown crown, buff cheeks, nuanced dark umber along top third of bridge, soft ivory along lower jaw and right muzzle, quiet soft transitions. No flank spotting on the face. BOTTOM HALF ONLY = Bengal tiger head coat, burnt ochre orange crown and bridge, irregular tapered branching black temple stripes concentrated on upper and middle LEFT TWO THIRDS that break into short cheek bars, broad creamy white lower cheeks and ivory chin, warm muzzle bridge on right. Individual colored fur fibers interrupt and soften the edges of each stripe. Markings should look organic, warm and matte. Strict exclusions: no eyes, pupils, eye openings, rendered face, actual nose, nostrils, lips, ears, whisker shafts, horns, silhouettes, backdrop, text, labels, gutters, shadows, black borders or graphic elements. Those details are separate geometry in the game; these are skin texture sheets.

**四肢图集**

A square game texture atlas. Precisely two adjacent equally wide vertical rectangular panels, fill the frame edge-to-edge, without any gap. Both are FLAT orthographic PBR base-color UV textures for a mammal's limb. No modeled leg shape, silhouette, background, horizon, paw outline, claws, hooves, text, dividers, labels, highlights or shadows. Very high-fidelity short matte fur, the actual pigmentation and individual hairs, with small aligned clumps and some longer guard hairs, sharp and photographically credible. In both panels TOP is the shoulder/haunch, BOTTOM is just above the toes/hoof; hair lies mostly downward, turning slightly around knee and hock. LEFT HALF: Indian chital deer fore/hind leg. Upper third rich subdued chestnut brown with a few small distinct ivory spots at the OUTSIDE shoulder only, middle is dusty tan, lower half muted sandy buff with fine warmer and darker fibers, a subtle pale inside margin and darker outer ridge. RIGHT HALF: Bengal tiger fore/hind leg. Rich tawny ochre upper half with unmistakable broad charcoal-black broken tiger bands: around 4-5 irregular tapered oblique transverse stripes distributed from upper shoulder to lower shin. Thick branching upper arm bands and a few narrower broken bands, edges resolve into small groups of hairs. In the lower FIFTH the stripes taper away; soft wheat-cream inner fur on the right side of this swatch and honey-buff paw tops at the bottom. Naturalistic mammalian hair with directional visible strand detail in every region, softly varied pigment in shadows-free flat daylight. No head or bodies. Material swatches, not photographs of animals.

</details>

## 动物动作参考与触发条件

- **花鹿移动、吃草和饮水**　花鹿观察记录将移动、取食和饮水分别编码。本作以交错的四肢支撑和摆动表现行走。连续两步中，同一只鹿原地增能且脚下草量下降时，画面压低前躯、转下颈部并活动下颌。连续原地停留且相邻格有水时，鹿才会面向水面低头。低头取食与临水低头的姿势区别另参考了有蹄类的观察行为表。[花鹿活动记录，Rajawat 与 Chandra](https://environmentandecology.com/wp-content/uploads/2024/09/MS5-8.pdf) · [野外与圈养观察的行为表](https://doi.org/10.1371/journal.pone.0284221)
- **孟加拉虎行走、涉水和取食**　行走时四足错相，足掌在摆动期向前，支撑期相对身体向后。真实虎的步行肢位有运动学测量；动物园也记录了虎善游泳。三维表现让入水移动的虎降低躯干、抬头，以四肢划水。成功获取能量的捕猎或食腐事件可触发低头咬合。步幅和划水幅度按本作模型调校。[Day 与 Jayne 的猫科步态研究，含虎](https://pubmed.ncbi.nlm.nih.gov/17267650/) · [史密森尼国家动物园的虎物种资料](https://nationalzoo.si.edu/animals/tiger)
- **虎舔水**　岸边停步时，虎屈低前躯，吻端靠近水面，近景模型的舌和下颌交替伸收。Reis 等人的实验补充材料包含虎的高速摄影。本文只据此设计动作顺序，模型中的频率为表现参数。[Science 论文](https://pubmed.ncbi.nlm.nih.gov/21071630/) · [含虎拍摄说明的实验补充材料](https://www.epfl.ch/labs/flexlab/wp-content/uploads/2017/12/27_2010_Reis_Science_sm.pdf)
- **沼泽鳄游动与进食**　水中移动时，四肢靠近体侧，侧向弯曲沿躯干传向尾尖，尾部幅度较大。陆地移动时四肢展开交替迈动，成功取食时下颌开合。游姿参考鳄类运动资料和其他鳄属物种的实测，属于鳄类共有运动方式的近似。[IUCN 鳄类专家组](https://www.iucncsg.org/pages/Locomotion.html) · [Davenport 与 Sayer 的鳄属游动观察](https://www.thebhs.org/publications/the-herpetological-journal/volume-1-number-8-december-1989/1206-06-observations-on-the-aquatic-locomotion-of-young-salt-water-crocodiles-crocodylus-porosus-schneider/file)

饮水是岸边表现动作，上游没有口渴值或饮水事件。动画只消费位置、水量、能量和事件，模拟中的生死、能量及水量仍由上游决定。姿态由上述参考和原有模型手工编写。客户端步态把一个周期分为支撑和摆动：支撑时足掌相对躯干后移以抵消前进距离，摆动时抬脚前送。约 60% 的支撑占比是本作的动作调校值。

## 玻璃生态博物馆的界面美术

展馆摄影风格图、玻璃材质与物种展签由 ImageGen 为本项目生成，网页使用裁切后的 WebP 图像。画面中的展馆是虚构展陈空间。标题、物种名称、实时数字和事件文字排在展签及监控面板上，图表和小地图读取实际模拟数据。

- [展厅背景](ui/gallery.webp) 的生成描述采用深色玄武岩、两侧通透玻璃、展柜里的河岸草木与顶部暖光。中央留出空间放置真正可旋转的三维河漫滩。
- [银绿色磨砂玻璃](ui/silver-glass.webp)、[浅青玻璃展签](ui/jade-glass.webp)、[烟色玻璃](ui/smoke-glass.webp) 与 [玄武岩饰面](ui/basalt.webp) 取自同一张四格材质图。生成时预留空白中心与窄玻璃边缘，供中文标签、控件及数据排版。
- 四张物种导航图取自同一张展柜摄影风格图集，分别展示 [河道全景](ui/river.webp)、[花鹿](ui/chital.webp)、[孟加拉虎](ui/tiger.webp) 和 [沼泽鳄](ui/mugger.webp)。选中状态采用浅色玻璃铭牌。

## 风、草与水

草根固定在地面，草叶和穗头按离地高度弯折。同一组风向和阵风强度给水面施加扰动。水面高度和速度使用带阻尼的二维线性浅水波近似，水深影响传播速度，湿三角形之间交换等量反向通量，干涸区域退出计算。动物尾迹、雨点和点击都向这一水面施加局部冲量。河流的水量与干湿判定仍读取上游状态。波速与水深关系参考 [Clawpack 浅水方程文档](https://www.clawpack.org/riemann_book/html/Shallow_water_approximate.html)。

## 展柜日光与材质采光

- **先用一盏主光交代方向。** 河漫滩采用固定的左上侧光，光源在全景相机左侧略偏后，仰角约 40°。这个角度给树干、鹿腿和鳄背盾鳞留出明暗两面。ERCO 的展陈指南讨论了侧向重点照明如何塑造体积，以及偏暖的重点光配合偏冷的基础照明。本作的角度和强度按展柜镜头调校。[ERCO：用光影塑造立体展品](https://www.erco.com/en/knowledge/culture/white-cube/sculpture-lighting/)
- **再给暗部留细节。** 冷色天空与较暗的暖色地面提供半球补光，正面一层弱反射光保留眼睛和吻部。降雨增强时，侧光平滑减弱、天空补光增加；随风移动的云影作为直射光透过率的艺术近似。颜色在线性空间参与光照，最终经 ACES 色调映射输出。[Three.js 半球光](https://threejs.org/docs/pages/HemisphereLight.html) · [Three.js 色彩管理](https://threejs.org/manual/en/color-management.html)
- **让影子跟着真正的投影者。** 实时动物的投影使用与可见皮肤相同的肢体、头颌和尾部变形，草影使用同一风场。全景阴影覆盖展柜；靠近动物时，第二张只记录深度的阴影图覆盖观察点周围约 20 × 20 个场景单位，两图在边缘渐变。近景投影按光空间纹素对齐。脚下另有轻微接触遮蔽，随地面坡向放置。[Three.js 阴影相机与阴影贴图分辨率](https://threejs.org/manual/en/shadows.html)
- **最后校准反射。** 水面读取主光的实际方向、颜色和遮挡。反射方向来自眼睛与波面法线，正视水面较易看见河床，沿水面看时窗光反射增强。水与玻璃的正入射反射率分别取约 0.0204 和 0.04，按 Schlick 近似过渡到掠射角。展厅环境反射使用预滤波与亮部压缩，保留动物轮廓；属于实时环境近似。[《Physically Based Rendering》第四版：镜面反射与透射](https://pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission)

### 光照资产来源

- [展厅 HDR 环境探针](textures/hall-prefiltered.hdr) 来自 Poly Haven 的 *Events Hall Interior*，摄影 Dimitrios Savva，处理 Jarod Guest，CC0。原始 1K Radiance HDR 缩为 256 × 128，经 Three.js 的 PMREMGenerator 离线生成 336 × 256 的多粗糙度 CubeUV 图集，保留线性高动态范围，按主要窗光方向旋转。运行时分发同一图集的 gzip 压缩半精度像素，首帧之后再由后台线程解压。它给玻璃、水面和精细模型提供室内采光参考。画面中可见的展厅背景仍是本项目的生图展厅。[资产页](https://polyhaven.com/a/events_hall_interior) · [Poly Haven 授权](https://polyhaven.com/license)
- [河岸地表细节](textures/floodplain-ground.webp) 来自 Amal Kumar 的 *Sparse Grass*，CC0。取其漫反射图的相对亮度、OpenGL 法线 XY 分量与植被遮罩，打包为 384 × 384 无损 WebP。近景用约两米幅宽显示土粒与草根的受光，实际草量、水量和泥滩范围由生态快照决定。[资产页](https://polyhaven.com/a/sparse_grass)

## 草甸、娑罗树与动物毛发

- **草叶与草丛美术。** 远处草丛和「近看草地」图标取自 *Grass Medium 01* 的漫反射和透明度图集，建模 Rico Cilliers，摄影 Rob Tuytel。选取一簇正面草叶，提取轮廓，按展柜日光调整颜色，保存为 256 × 118 的透明纹理。近处另外种植弧形立体草叶。两档共用草量、风和压草方向，草根贴合地形。[本地草丛纹理](textures/meadow-clump.webp) · [Poly Haven 原资产](https://polyhaven.com/a/grass_medium_01) · [CC0 授权](https://polyhaven.com/license)
- **风和踩踏。** 参考 NVIDIA 的批量草丛与顶点风动、AMD 的草叶曲线、根梢明暗与距离分级。浏览器根据动物补帧后的真实位置记录局部压弯方向，离开后随时间恢复。草叶密度、弯曲幅度和恢复速度是展柜的美术调校值。[NVIDIA《GPU Gems》草地章节](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-7-rendering-countless-blades-waving-grass) · [AMD GPUOpen 程序化草地](https://gpuopen.com/learn/mesh_shaders/mesh_shaders-procedural_grass_rendering/)
- **娑罗树换叶。** 印度特莱林区的样地记录了旱季落叶，以及落叶和新叶萌发重叠的个体差异。展柜以现有娑罗树骨架和折叶为原型，分别保留枝干和叶基；天气、岸距、土壤养分控制展叶、枯黄与木质部分的增长。树高和叶量是场景近似，刷新后按当前步数和环境重建。[Joshi 与 Bagri 的娑罗树林地观测](https://doi.org/10.51470/JOD.2025.4.2.01)
- **鹿、虎毛被。** 花鹿的白斑和孟加拉虎的橙底黑褐纹参照博物馆及动物园的照片、物种资料。在躯干、四肢、脸颊、外耳、下颌、虎爪背和虎尾上分布逐根收尖的几何毛束。毛根取所属表面的贴图颜色和局部色素，沿腿向下梳理，在爪背转向趾尖，耳缘朝外。下颌毛束与下颌皮肤共用开合动作。实时版本仅在近景绘制这些毛束，继承身体各部位的动作。毛长、密度和梳理方向为本作设计。[法国国家自然历史博物馆 · 花鹿](https://www.mnhn.fr/en/chital) · [圣迭戈动物园 · 孟加拉虎](https://animals.sandiegozoo.org/animals/tiger) · [Epic Games · 毛发的网格表示和距离分级](https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-cards-and-meshes-for-grooms-in-unreal-engine)


### 鹿虎肩胯和颈部的衔接

建模时用 Blender 自带的 OpenVDB 合并躯干、四肢、颈、头和虎爪的外轮廓，在肩胛、胯部和颊部留出圆滑的过渡。每只动物的主皮面有 6,400 个三角形。沿整张皮面展开后，将原有的躯干纹样逐渐过渡到颈颊和腿部的毛色，烘焙为 2048 × 2048 的底色贴图。毛束取色和运动权重都来自同一皮面。下颌单独开合。两种贴图都由本项目的原画生成。[花鹿被毛](textures/chital-pelt.jpg) · [孟加拉虎被毛](textures/tiger-pelt.jpg) · [同机位实景对照](previews/coat-junctions.webp)
