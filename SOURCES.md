# 拉普蒂河漫滩的参考来源

## 场景为何选奇特旺

奇特旺位于喜马拉雅山麓的特莱低地。拉普蒂河沿公园北侧流过，河岸林、冲积草地和以娑罗树为主的林区在当地相接。模型把这三类环境压缩在一段约 18 米宽的展示地块上。河道的弯曲、动物间距与镜头构图是本作设计。[联合国教科文组织 · 奇特旺国家公园](https://whc.unesco.org/en/list/284/)

公园管理计划把林草交界带列为花鹿常见的环境，并记载沼泽鳄与湿地的关系。尼泊尔国家自然保护信托的相机调查收录了奇特旺的花鹿与孟加拉虎，河流监测也记录了当地的沼泽鳄。场景据此将鹿放在草岸、虎放在林缘、鳄放在浅水。它们的位置共同展示栖息地分区。[公园管理计划](https://chitwannationalpark.gov.np/index.php/reports/publications?download=43%3Amanagement-plan-printed) · [奇特旺哺乳动物相机调查](https://www.ntnc.org.np/publication/mammals-chitwan-national-park-and-its-surroundings-account-camera-trap-survey) · [奇特旺与巴迪亚的鳄类监测](https://ntnc.org.np/newsletter/crocodile-monitoring-chitwan-and-bardia)

## 动物外形

- **花鹿**　选择 *Axis axis* 对应模拟器中的鹿。体侧白斑纵向成列，雄鹿角分三个尖，雌鹿也保留斑点。建模时分别处理躯干、细腿、分趾蹄和鹿角。[密歇根大学 Animal Diversity Web · 花鹿](https://animaldiversity.org/accounts/Axis_axis/)
- **孟加拉虎**　亚种取自奇特旺调查。用赭橙色底毛和收尖的深色条纹表现体侧，浅色口鼻与黑色耳背形成头部轮廓。[奇特旺国家公园哺乳动物图录](https://ntnc.org.np/sites/default/files/doc_publication/2024-08/Mammals_of_CNP_2024.pdf) · [圣迭戈动物园 · 虎的被毛](https://animals.sandiegozoo.org/animals/tiger) · [史密森尼国家动物园 · 虎的体貌](https://nationalzoo.si.edu/animals/tiger)
- **沼泽鳄**　选择 *Crocodylus palustris*。宽而钝的吻部、顶部眼鼻、隆起背鳞和长尾是建模时保留的识别点。[尼泊尔国家自然保护信托 · 沼泽鳄](https://ntnc.org.np/newsletter/crocodile-monitoring-chitwan-and-bardia) · [物种资料与吻部形态](https://crocodilian.com/cnhc/csp_cpal.htm) · [印度拉贾斯坦邦林业部门 · 两栖爬行动物图录](https://environment.rajasthan.gov.in/content/dam/raj/forest/ForestDepartment/PDFs/Preliminary-Birds-guide-/Reptiles%20%26%20Amphibians%20book%20of%20MHTR0.pdf)

## 两个项目各提供了什么

- **HryYyR/SimulationWorld**　核对版本 `d663d08b13237c4cc53c3a8ba36468cf6aa30f01`。生态设计定义“草 → 鹿 → 虎”；实际物种配置还有鳄，鹿的禁行地形和鳄的允许地形都指向河流。世界生成支持弯曲河道。三维资产采用同一组动物和水陆关系，网格、贴图及展示程序均在本仓库制作。[生态设计](https://github.com/HryYyR/SimulationWorld/blob/d663d08b13237c4cc53c3a8ba36468cf6aa30f01/SimulationWorld.md) · [物种配置](https://github.com/HryYyR/SimulationWorld/blob/d663d08b13237c4cc53c3a8ba36468cf6aa30f01/cfg/species.json) · [地形生成](https://github.com/HryYyR/SimulationWorld/blob/d663d08b13237c4cc53c3a8ba36468cf6aa30f01/internal/world/world.go)
- **《万物有应》**　本地核对 `297897d4b36d42429503e81f3ef5146ab58d2869` 的 `docs/美术资产.md`「入山」、`models/valley.py` 和客户端山谷视图。沿用青绿矿物设色、实体部件、分层植被、贴图随源码保存、Blender → GLB → Three.js，以及直接点选所见地表的做法。本作的娑罗树、河床和动物均按奇特旺另建。[项目仓库（访问权限随原项目）](https://github.com/dragon717/wanwuyouying)

## 材质与预览的制作来源

三组原始纹理用内置 ImageGen 生成，裁切为以下 JPEG。上述机构资料用于造型观察；仓库内的动物和景观预览均由实际 Blender 网格渲染。

| 生成内容 | 提示词要点 | 成品 |
| --- | --- | --- |
| 宣纸矿物底纹 | 正射微距、暖象牙白宣纸纤维、浅灰矿物沉积与淡墨洇边，低反差、均匀照明。以网格顶点颜色叠出草木、河水、沙滩的色差。 | [底纹](textures/pigment.jpg) |
| 三种动物的体表 | 三行横向材质图集，上行虎的赭橙短毛和收尖黑纹，中行花鹿的栗色与行列白斑，下行沼泽鳄的橄榄灰皮肤与盾鳞。 | [虎](textures/tiger.jpg) · [鹿](textures/chital.jpg) · [鳄](textures/mugger.jpg) |
| 虎与鹿的四肢 | 对半分隔的平面皮毛样本，虎腿为稀疏横向断纹，鹿腿从上部少量白斑过渡至浅黄褐色。毛流沿腿向下。 | [虎腿](textures/tiger-leg.jpg) · [鹿腿](textures/chital-leg.jpg) |
