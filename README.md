# cocos create JPS寻路(跳点寻路)算法TS版本
***
- 简介
```$xslt
+ 最近又研究了一下跳点寻路所以又来分享给大家了接口什么的没变,此外还有a星什么的也有自己翻阅哈
+ 具体原理参考 https://zhuanlan.zhihu.com/p/25093275
```
![avatar](https://github.com/microcisco/jpsFindPath/blob/master/demo.gif)


- 快速使用
```$xslt
    private customGenerateLogicMap() {
        let mapData = AutoFindPath.formatToMapData(this.map, this.map.children[0].width);
        let autoFindPath = new AutoFindPath(mapData);
        this.autoFindPath = autoFindPath;
        //更新当前地图里所有障碍物
        for (const child of this.obstacles.children) autoFindPath.updateMap(child);
    }

    private searchPath() {
        let pos0 = cc.find('Canvas/起点');
        let pos1 = cc.find('Canvas/终点');
        let paths = this.autoFindPath.gridPositionConvertGameObjectPosition(this.autoFindPath.findGridPath(pos0, pos1, models.normal),
            cc.v2(0.5, 0.5), cc.Vec2);
        if (paths.length === 0) console.log('死路');
        for (let i = 0; i < paths.length; i++) {
            this.scheduleOnce(() => {
                pos0.runAction(cc.moveTo(0.5, paths[i]));
            }, i * 0.5);
        }
    }

    start() {
        this.customGenerateLogicMap();
        this.searchPath();
    }
```
![avatar](https://github.com/microcisco/astartForTS/blob/master/1.png)


![avatar](https://github.com/microcisco/astartForTS/blob/master/2.png)


---
- 扩展
```$xslt
本项目还可以动态的添加和移除障碍物（比如建筑物被攻击后可以移动到该位置，以及在游戏过程中添加建筑），更多细节可以看核心类AutoFindPath
1. 移除障碍物的方法是
autoFindPath.removeFixObstacle(...obstacles);
1. 添加障碍物的方法是
autoFindPath.updateMap(...obstacles);
```
---
- 结尾
```$xslt
有问题欢迎大家提issue
```
