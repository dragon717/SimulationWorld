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

三组原始纹理用内置 ImageGen 生成，裁切为以下 JPEG。上述机构资料用于造型观察；仓库内的动物和景观预览均由实际 Blender 网格渲染。

| 生成内容 | 提示词要点 | 成品 |
| --- | --- | --- |
| 宣纸矿物底纹 | 正射微距、暖象牙白宣纸纤维、浅灰矿物沉积与淡墨洇边，低反差、均匀照明。以网格顶点颜色叠出草木、河水、沙滩的色差。 | [底纹](textures/pigment.jpg) |
| 三种动物的体表 | 三行横向材质图集，上行虎的赭橙短毛和收尖黑纹，中行花鹿的栗色与行列白斑，下行沼泽鳄的橄榄灰皮肤与盾鳞。 | [虎](textures/tiger.jpg) · [鹿](textures/chital.jpg) · [鳄](textures/mugger.jpg) |
| 虎与鹿的四肢 | 对半分隔的平面皮毛样本，虎腿为稀疏横向断纹，鹿腿从上部少量白斑过渡至浅黄褐色。毛流沿腿向下。 | [虎腿](textures/tiger-leg.jpg) · [鹿腿](textures/chital-leg.jpg) |

## 动物动作参考与触发条件

- **花鹿移动、吃草和饮水**　花鹿观察记录将移动、取食和饮水分别编码。本作以交错的四肢支撑和摆动表现行走。连续两步中，同一只鹿原地增能且脚下草量下降时，画面压低前躯、转下颈部并活动下颌。连续原地停留且相邻格有水时，鹿才会面向水面低头。低头取食与临水低头的姿势区别另参考了有蹄类的观察行为表。[花鹿活动记录，Rajawat 与 Chandra](https://environmentandecology.com/wp-content/uploads/2024/09/MS5-8.pdf) · [野外与圈养观察的行为表](https://doi.org/10.1371/journal.pone.0284221)
- **孟加拉虎行走、涉水和取食**　行走时四足错相，足掌在摆动期向前，支撑期相对身体向后。真实虎的步行肢位有运动学测量；动物园也记录了虎善游泳。三维表现让入水移动的虎降低躯干、抬头，以四肢划水。成功获取能量的捕猎或食腐事件可触发低头咬合。步幅和划水幅度按本作模型调校。[Day 与 Jayne 的猫科步态研究，含虎](https://pubmed.ncbi.nlm.nih.gov/17267650/) · [史密森尼国家动物园的虎物种资料](https://nationalzoo.si.edu/animals/tiger)
- **虎舔水**　岸边停步时，虎屈低前躯，吻端靠近水面，近景模型的舌和下颌交替伸收。Reis 等人的实验补充材料包含虎的高速摄影。本文只据此设计动作顺序，模型中的频率为表现参数。[Science 论文](https://pubmed.ncbi.nlm.nih.gov/21071630/) · [含虎拍摄说明的实验补充材料](https://www.epfl.ch/labs/flexlab/wp-content/uploads/2017/12/27_2010_Reis_Science_sm.pdf)
- **沼泽鳄游动与进食**　水中移动时，四肢靠近体侧，侧向弯曲沿躯干传向尾尖，尾部幅度较大。陆地移动时四肢展开交替迈动，成功取食时下颌开合。游姿参考鳄类运动资料和其他鳄属物种的实测，属于鳄类共有运动方式的近似。[IUCN 鳄类专家组](https://www.iucncsg.org/pages/Locomotion.html) · [Davenport 与 Sayer 的鳄属游动观察](https://www.thebhs.org/publications/the-herpetological-journal/volume-1-number-8-december-1989/1206-06-observations-on-the-aquatic-locomotion-of-young-salt-water-crocodiles-crocodylus-porosus-schneider/file)

饮水是岸边表现动作，上游没有口渴值或饮水事件。动画只消费位置、水量、能量和事件，模拟中的生死、能量及水量仍由上游决定。姿态由上述参考和原有模型手工编写。

## 玻璃生态博物馆的界面美术

展馆摄影风格图、玻璃材质与物种展签由 ImageGen 为本项目生成，网页使用裁切后的 WebP 图像。画面中的展馆是虚构展陈空间。标题、物种名称、实时数字和事件文字排在展签及监控面板上，图表和小地图读取实际模拟数据。

- [展厅背景](ui/gallery.webp) 的生成描述采用深色玄武岩、两侧通透玻璃、展柜里的河岸草木与顶部暖光。中央留出空间放置真正可旋转的三维河漫滩。
- [银绿色磨砂玻璃](ui/silver-glass.webp)、[浅青玻璃展签](ui/jade-glass.webp)、[烟色玻璃](ui/smoke-glass.webp) 与 [玄武岩饰面](ui/basalt.webp) 取自同一张四格材质图。生成时预留空白中心与窄玻璃边缘，供中文标签、控件及数据排版。
- 四张物种导航图取自同一张展柜摄影风格图集，分别展示 [河道全景](ui/river.webp)、[花鹿](ui/chital.webp)、[孟加拉虎](ui/tiger.webp) 和 [沼泽鳄](ui/mugger.webp)。选中状态采用浅色玻璃铭牌。

## 风、草与水

草根固定在地面，草叶和穗头按离地高度弯折。同一组风向和阵风强度给水面施加扰动。水面高度和速度使用带阻尼的二维线性浅水波近似，水深影响传播速度，湿三角形之间交换等量反向通量，干涸区域退出计算。动物尾迹、雨点和点击都向这一水面施加局部冲量。河流的水量与干湿判定仍读取上游状态。波速与水深关系参考 [Clawpack 浅水方程文档](https://www.clawpack.org/riemann_book/html/Shallow_water_approximate.html)。
