export interface Vector2 {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

interface V2<T> {
    new(x: number, y: number): T;
}

//寻路的路点信息
class PathPointData implements Vector2 {
    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    x: number = 0;  //X axis position
    y: number = 0;  //Y axis position
    F: number = 0;  //G + H + K
    G: number = 0;  //开始点到当前路点的移动量
    H: number = 0;  //当前路点到目标点的移动量估值
    parent: PathPointData = null;  //上一个节点
    K: number = lands.normal  //地形值

}

export type GameObject = Size & Vector2 & { anchorX: number, anchorY: number, angle: number };

//模式
export const enum models {
    normal,  //普通的
    tilt,    //倾斜的
}

//地形
export const enum lands {
    normal = 1,  //普通的
    hard = 2,    //类似沼泽之类的
}

/**@description 每张地图对应一个寻路实例。 全部给世界坐标，返回的也全部是世界坐标*/
export class JPS {
    //分隔符
    private static sep: string = "_";
    //模式
    private model: models = models.tilt;
    //地图映射   格子坐标<>当前格子的K数值（K值用于处理不同的地形）
    private mapTable: Map<string, PathPointData> = new Map<string, PathPointData>();
    //open列表
    private openList: PathPointData[] = [];
    private openListMap: Map<string, PathPointData> = new Map<string, PathPointData>();
    //closed列表
    private fixClosedListMap: Map<string, PathPointData> = new Map<string, PathPointData>();
    private closedListMap: Map<string, PathPointData> = new Map<string, PathPointData>();
    //出生点
    private bronPoint: PathPointData = null;
    //目标点
    private targetPoint: PathPointData = null;
    //当前寻路点
    private nowPoint: PathPointData = null;
    //地图数据
    private readonly mapData: GameObject & { gridLength: number } = null;

    /**@description 格式化成地图数据*/
    public static formatToMapData(gameObject: GameObject, gridLength: number): GameObject & { gridLength: number} {
        return {
            anchorY: gameObject.anchorY,
            anchorX: gameObject.anchorX,
            height: gameObject.height,
            width: gameObject.width,
            x: gameObject.x,
            y: gameObject.y,
            gridLength: gridLength,
            angle: -gameObject.angle,
        };
    }

    /**@description 根据格子对象获取对应的key值*/
    private static getKey(p: Vector2) {
        return p.x.toString() + JPS.sep + p.y.toString();
    }

    /**@description 添加到openList*/
    private addToOpenList(v2: PathPointData) {
        let p = JPS.getKey(v2);
        v2 = this.mapTable.get(JPS.getKey(v2))
        if (this.mapTable.get(p) === void 0) throw new Error('this point not in map');
        if (this.openListMap.get(p)) {
            //该点已经在open列表中 && 重新计算F值 && 新F值更低就将父方格修改为当前节点否则什么都不做
            let oldParent = v2.parent;
            let oldF = v2.F;
            v2.parent = this.nowPoint;
            this.F(v2);
            if (v2.F > oldF) {
                v2.parent = oldParent;
                this.F(v2);
                return;
            }
            return;
        } else {
            v2.parent = this.nowPoint;  //设置父方格
            this.F(v2);  //计算F值
        }
        this.openList.push(v2);
        this.openListMap.set(p, this.mapTable.get(p));
    }

    /**@description 是否已经在closedList中*/
    private isInClosedList(p: Vector2) {
        let key = JPS.getKey(p);
        return !!(this.fixClosedListMap.get(key) || this.closedListMap.get(key));
    }

    /**@description 移除最小F值的路点*/
    private removeMinFFromOpenList(): PathPointData {
        //排序
        this.openList.sort((a: PathPointData, b: PathPointData) => {
            if (a.F > b.F) return -1;
            return 1
        });
        let v2: PathPointData = this.openList.pop();
        if(v2) {
            this.removeFromOpenList(v2);
            return this.mapTable.get(JPS.getKey(v2))
        } else {
            return null;
        }

    }

    /**@description 移除最小F值的路点*/
    private removeFromOpenList(v2: PathPointData) {
        let p = JPS.getKey(v2);
        if (!this.openListMap.has(p)) throw new Error('not in openList');
        this.openListMap.delete(p);
    }

    /**@description 添加到closedList*/
    private addToClosedList(v2: PathPointData) {
        let p = JPS.getKey(v2);
        if (this.mapTable.get(p) === void 0) throw new Error('this point not in map');
        if (this.closedListMap.get(p)) throw new Error('is in closedList');
        this.closedListMap.set(p, this.mapTable.get(p));
    }

    // 单次寻路最大限制次数
    private readonly searchLimit: number = 688;

    /**@description 构造函数
     * @param mapData 地图坐标，地图尺寸，格子尺寸
     * @param obstacles 障碍物坐标及尺寸
     * */
    public constructor(mapData: GameObject & { gridLength: number, searchLimit?: number }, obstacles?: GameObject[]) {
        if (mapData.searchLimit > 0) this.searchLimit = mapData.searchLimit;
        mapData.x = mapData.x - mapData.width * mapData.anchorX;
        mapData.y = mapData.y - mapData.height * mapData.anchorY;
        this.mapData = mapData;
        for (let i = 0, i1 = Math.ceil(mapData.width / this.mapData.gridLength); i < i1; ++i) {
            for (let j = 0, j1 = Math.ceil(mapData.height / this.mapData.gridLength); j < j1; ++j) {
                this.mapTable.set(i.toString() + JPS.sep + j.toString(), new PathPointData(i, j));
            }
        }
        if (obstacles) this.updateMap(...obstacles);
    }

    /**@description 根据游戏对象获取格子*/
    private getGridPositions(nodeData: GameObject): string[] {
        let vec2s: string[] = [];
        let width = nodeData.width;
        let height = nodeData.height;
        if (nodeData.angle === -90 || nodeData.angle === -270) {
            width = width + height;
            height = width - height;
            width = width - height;
        }
        let minX = nodeData.x - width * nodeData.anchorX;
        let maxX = nodeData.x + width * (1 - nodeData.anchorX);
        let minY = nodeData.y - height * nodeData.anchorY;
        let maxY = nodeData.y + height * (1 - nodeData.anchorY);
        let minPoint = this.getGridPositionRaw({x: minX, y: minY});
        let w = this.getGridPositionRaw({x: maxX, y: minY}).x - minPoint.x + 1;
        let h = this.getGridPositionRaw({x: minX, y: maxY}).y - minPoint.y + 1;
        let startGridX = minPoint.x;
        let startGridY = minPoint.y;
        for (let i = 0, i1 = w; i < i1; ++i) {
            for (let j = 0, j1 = h; j < j1; ++j) {
                let key = (i + startGridX).toString() + JPS.sep + (startGridY + j).toString();
                if (this.mapTable.get(key) === void 0) continue;  //超出地图不做处理
                vec2s.push(key);
            }
        }
        return vec2s;
    }

    /**@description 根据游戏对象获取格子（可能不在地图中）*/
    private getGridPositionRaw(v2: Vector2): Vector2 {
        return {
            x: Math.floor((v2.x - this.mapData.x) / this.mapData.gridLength),
            y: Math.floor((v2.y - this.mapData.y) / this.mapData.gridLength)
        };
    }

    /**@description 根据游戏对象获取格子*/
    public getGridPosition(v2: Vector2): PathPointData {
        return this.mapTable.get(JPS.getKey(this.getGridPositionRaw(v2)));
    }

    /**@description 更新地图信息*/
    updateMap(...obstacles: GameObject[]) {
        for (const obstacle of obstacles) {
            if (obstacle.width * obstacle.height < 2) continue;  //尺寸过小忽略
            for (const gridPositionKey of this.getGridPositions(obstacle)) {
                this.fixClosedListMap.set(gridPositionKey, this.mapTable.get(gridPositionKey));
            }
        }
    }

    /**@description 更新地图信息*/
    removeFixObstacle(...obstacles: GameObject[]) {
        for (const obstacle of obstacles) {
            for (const gridPositionKey of this.getGridPositions(obstacle)) {
                this.fixClosedListMap.delete(gridPositionKey);
            }
        }
    }

    /**@description 更新地图信息*/
    removeAllObstacle() {
        this.fixClosedListMap.clear();
    }

    //检查各自是否可走
    private isClear(point: Vector2) {
        const key = JPS.getKey(point);
        return this.mapTable.get(key) && !this.fixClosedListMap.get(key)
    }

    /**@description 自动寻找新路点并根据F值排序*/
    private autoAddPathPoint() {
        //上
        let p0 = {x: this.nowPoint.x, y: this.nowPoint.y + 1};
        //右
        let p1 = {x: this.nowPoint.x + 1, y: this.nowPoint.y};
        //下
        let p2 = {x: this.nowPoint.x, y: this.nowPoint.y - 1};
        //左
        let p3 = {x: this.nowPoint.x - 1, y: this.nowPoint.y};
        let maybePoints: Vector2[] = [p0, p1, p2, p3];
        if (this.model === models.tilt) {
            if (!this.isInClosedList(p0) && !this.isInClosedList(p1)) {
                //右上角 && 上和右不能有阻挡
                maybePoints.push({x: this.nowPoint.x + 1, y: this.nowPoint.y + 1});
            }
            if (!this.isInClosedList(p2) && !this.isInClosedList(p1)) {
                //右下角 && 下和右不能有阻挡
                maybePoints.push({x: this.nowPoint.x + 1, y: this.nowPoint.y - 1});
            }
            if (!this.isInClosedList(p0) && !this.isInClosedList(p3)) {
                //左上角 && 上和左不能有阻挡
                maybePoints.push({x: this.nowPoint.x - 1, y: this.nowPoint.y + 1});
            }
            if (!this.isInClosedList(p2) && !this.isInClosedList(p3)) {
                //左下角 && 下和左不能有阻挡
                maybePoints.push({x: this.nowPoint.x - 1, y: this.nowPoint.y - 1});
            }
        }

        let targetPointKey = JPS.getKey(this.targetPoint);
        for (const point of maybePoints) {
            let key = JPS.getKey(point);
            let pathPoint = this.mapTable.get(key);
            if (pathPoint === void 0) continue;
            //有障碍物在终点做特殊处理
            if (!this.isInClosedList(pathPoint) || key === targetPointKey) this.addToOpenList(pathPoint);
        }
    }

    forcedNeighbour(from: Vector2, direction: Vector2) {
        const {x, y} = from;
        const dx = direction.x;
        const dy = direction.y;
        const forced = []
        if (dy === 0 && this.isClear({x: x + dx, y: y})) {
            //水平
            if (!this.isClear({x, y: y - 1})) {
                forced.push({x: x + dx, y: y - 1});
            }
            if (!this.isClear({x, y: y + 1})) {
                forced.push({x: x + dx, y: y + 1});
            }
        } else if (dx === 0 && this.isClear({x: x, y: y + dy})) {
            //垂直
            if (!this.isClear({x: x - 1, y: y})) {
                forced.push({x: x - 1, y: y + dy});
            }
            if (!this.isClear({x: x + 1, y: y})) {
                forced.push({x: x + 1, y: y + dy});
            }
        } else {
            if (this.isClear({x: x, y: y + dy})) {
                if (!this.isClear({x: x - dx, y: y})) {
                    forced.push({x: x - dx, y: y + dy});
                }
            }
            if (this.isClear({x: x - 1, y: y})) {
                if (!this.isClear({x: x, y: y - dy})) {
                    forced.push({x: x + dx, y: y - dy});
                }
            }
        }
        return forced.filter(v => this.isClear(v));
    }

    cloneV2(p): Vector2 {
        return {x: p.x, y: p.y}
    }

    private up: Vector2 = {x: 0, y: 1}
    private right: Vector2 = {x: 1, y: 0}
    private down: Vector2 = {x: 0, y: -1}
    private left: Vector2 = {x: -1, y: 0}

    //水平 && 竖直搜索
    searchBase(JPoint: Vector2[], point: Vector2, dirs: Vector2[]) {
        //水平方向查找
        const ptr: { x: number, y: number, state: number }[] = [
            {x: point.x, y: point.y, state: 1},
            {x: point.x, y: point.y, state: 1},
            {x: point.x, y: point.y, state: 1},
            {x: point.x, y: point.y, state: 1}
        ];
        for (const dir of dirs) {
            if (dir.y === 1) ptr[0].state = 0;
            if (dir.x === 1) ptr[1].state = 0;
            if (dir.y === -1) ptr[2].state = 0;
            if (dir.x === -1) ptr[3].state = 0;
        }
        while (true) {
            if (ptr[0].state === 0) {
                //上
                ptr[0].y += 1;
                if (!this.isClear(ptr[0])) {
                    ptr[0].state = 1;
                } else if(ptr[0].x === this.targetPoint.x && ptr[0].y === this.targetPoint.y) {
                    // 终点
                    ptr[0].state = 1;
                    if(this.nowPoint.x === point.x && this.nowPoint.y === point.y) {
                        // 直接查找
                        this.hasFindTarget = true;
                    } else {
                        // 通过该点可以找打终点
                        JPoint.push(this.cloneV2(ptr[0]));
                    }
                    return;
                } else {
                    if (this.forcedNeighbour(ptr[0], this.up).length) {
                        //存在强制邻居
                        JPoint.push(this.cloneV2(ptr[0]));
                    }
                }
            }
            if (ptr[1].state === 0) {
                //右
                ptr[1].x += 1;
                if (!this.isClear(ptr[1])) {
                    ptr[1].state = 1;
                    continue;
                } else if(ptr[1].x === this.targetPoint.x && ptr[1].y === this.targetPoint.y) {
                    // 终点
                    ptr[1].state = 1;
                    if(this.nowPoint.x === point.x && this.nowPoint.y === point.y) {
                        // 直接查找
                        this.hasFindTarget = true;
                    } else {
                        // 通过该点可以找打终点
                        JPoint.push(this.cloneV2(ptr[1]));
                    }
                    return;
                } else {
                    if (this.forcedNeighbour(ptr[1], this.right).length) {
                        //存在强制邻居
                        JPoint.push(this.cloneV2(ptr[1]));
                    }
                }
            }
            if (ptr[2].state === 0) {
                //下
                ptr[2].y -= 1;
                if (!this.isClear(ptr[2])) {
                    ptr[2].state = 1;
                    continue;
                } else if(ptr[2].x === this.targetPoint.x && ptr[2].y === this.targetPoint.y) {
                    // 终点
                    ptr[2].state = 1;
                    if(this.nowPoint.x === point.x && this.nowPoint.y === point.y) {
                        // 直接查找
                        this.hasFindTarget = true;
                    } else {
                        // 通过该点可以找打终点
                        JPoint.push(this.cloneV2(ptr[2]));
                    }
                    return;
                } else {
                    if (this.forcedNeighbour(ptr[2], this.down).length) {
                        //存在强制邻居
                        JPoint.push(this.cloneV2(ptr[2]));
                    }
                }
            }
            if (ptr[3].state === 0) {
                //左
                ptr[3].x -= 1;
                if (!this.isClear(ptr[3])) {
                    ptr[3].state = 1;
                    continue;
                } else if(ptr[3].x === this.targetPoint.x && ptr[3].y === this.targetPoint.y) {
                    // 终点
                    ptr[3].state = 1;
                    if(this.nowPoint.x === point.x && this.nowPoint.y === point.y) {
                        // 直接查找
                        this.hasFindTarget = true;
                    } else {
                        // 通过该点可以找打终点
                        JPoint.push(this.cloneV2(ptr[3]));
                    }
                    return;
                } else {
                    if (this.forcedNeighbour(ptr[3], this.left).length) {
                        //存在强制邻居
                        JPoint.push(this.cloneV2(ptr[3]));
                    }
                }
            }
            for (const ptrElement of ptr) {
                if(ptrElement.x === this.targetPoint.x && ptrElement.y === this.targetPoint.y) {
                    if(this.nowPoint.x === point.x && this.nowPoint.y === point.y) {
                        // 直接查找
                        this.hasFindTarget = true;
                    } else {
                        // 通过该点可以找打终点
                        JPoint.push(this.cloneV2(ptrElement));
                    }
                    return;
                }
            }
            if (ptr[0].state !== 0 && ptr[1].state !== 0 && ptr[2].state !== 0 && ptr[3].state !== 0) break;
        }
    }

    search45(arr: Vector2[], point: Vector2) {
        const allDir = [{x: 1, y: 1}, {x: 1, y: -1}, {x: -1, y: -1}, {x: -1, y: 1}];
        const arr1 = [];
        for (const dir of allDir) {
            let v2 = this.cloneV2(point);
            let tag;
            while (this.isClear(v2) &&
            (this.isClear({x: v2.x, y: v2.y + dir.y}) || this.isClear({x: v2.x + dir.x, y: v2.y}))) {
                if(v2.x === this.targetPoint.x && v2.y === this.targetPoint.y) {
                    if(this.nowPoint.x === point.x && this.nowPoint.y === point.y) {
                        // 直接查找
                        this.hasFindTarget = true;
                    } else {
                        arr.push(this.cloneV2(v2));
                    }
                    return;
                }
                if (tag && this.forcedNeighbour(v2, dir).length) {
                    // 自身不搜索强制邻居
                    arr.push(this.cloneV2(v2));
                    // 发现跳点不再搜索
                    break;
                }
                tag = true;
                arr1.length = 0;
                this.searchBase(arr1, v2, [dir]);
                if(this.hasFindTarget) {
                    // 发现终点
                    if(!this.isInClosedList(v2)) {
                        let pointData = new PathPointData(v2.x, v2.y);
                        this.addToOpenList(pointData);
                        this.nowPoint = this.mapTable.get(JPS.getKey(v2))
                    }
                    return;
                }
                if(arr1.length > 0) {
                    arr.push(this.cloneV2(v2));
                }
                v2.x += dir.x;
                v2.y += dir.y;
                if(v2.x === this.targetPoint.x && v2.y === this.targetPoint.y) {
                    // 终点
                    if(this.nowPoint.x === point.x && this.nowPoint.y === point.y) {
                        // 直接查找
                        this.hasFindTarget = true;
                    } else {
                        arr.push(this.cloneV2(v2));
                    }
                    return;
                }
            }
        }
    }

    /**
     * @description 寻路
     * @param {Vector2} bornPoint  出身点
     * @param {Vector2} targetPoint 目标点
     * @param {models} model 寻路模式
     * */
    private hasFindTarget:boolean = false;
    public findGridPath(bornPoint: GameObject | Vector2, targetPoint: GameObject | Vector2, model: models): Vector2[] {
        this.hasFindTarget = false;
        this.clear();
        this.model = model;  //寻路模式
        let p1: PathPointData = this.getGridPosition(bornPoint);
        let p2: PathPointData = this.getGridPosition(targetPoint);
        if (!p1 || !p2 ||
            this.fixClosedListMap.get(JPS.getKey(p1))
        ) return [];  //起点有问题

        this.nowPoint = this.bronPoint = this.mapTable.get(JPS.getKey(p1));
        // 重置起点
        this.nowPoint.parent = null;
        this.targetPoint = this.mapTable.get(JPS.getKey(p2));
        let paths: Vector2[] = [];  //路径
        if (JPS.getKey(p1) === JPS.getKey(p2)) {
            //终点和起点重合
            paths.push(this.targetPoint);
            return paths;
        }
        let maxSearchAmount = 0;  //重置搜寻次数

        //跳点
        const JPoint = [];
        while (!this.hasFindTarget) {
            this.addToClosedList(this.nowPoint);
            //水平方向查找
            if(!this.hasFindTarget) this.searchBase(JPoint, this.nowPoint, [{x: 1, y: 1}, {x: -1, y: -1}]);
            //45方向查找
            if(!this.hasFindTarget) this.search45(JPoint, this.nowPoint);

            if(this.hasFindTarget) {
                break;
            }
            for (const p of JPoint) {
                if(!this.isInClosedList(p)) {
                    this.addToOpenList(p);
                }
            }
            JPoint.length = 0;
            this.nowPoint = this.removeMinFFromOpenList();
            if (!this.nowPoint) return paths;  //死路
            if(++maxSearchAmount > 666) break;
        }

        if(this.hasFindTarget) {
            let p = this.nowPoint;
            const paths = [this.targetPoint, p]
            while (p.parent) {
                paths.push(p.parent);
                p = p.parent;
            }
            return paths.reverse();
        }
        return [];
    }

    /**@description 格子坐标转换为和地图同一坐标系的坐标
     * @param {Array}  positions 格子坐标数组
     * @param {Vector2} anchor 各自坐标
     * @param {T} ctor 构造函数
     * */
    public gridPositionConvertGameObjectPosition<T>(positions: Vector2[], anchor: Vector2, ctor: V2<T>): T[] {
        let res: T[] = [];
        for (const position of positions) {
            let x = position.x * this.mapData.gridLength + this.mapData.x + this.mapData.gridLength * anchor.x;
            let y = position.y * this.mapData.gridLength + this.mapData.y + this.mapData.gridLength * anchor.y;
            res.push(new ctor(x, y));
        }
        return res;
    }

    /**@description 检测该点是否包含固定障碍物*/
    public hasObstacle(v2: Vector2) {
        let res = true;
        try {
            res = !!this.fixClosedListMap.get(JPS.getKey(this.getGridPosition(v2)));
        } catch (e) {

        }
        return res;
    }

    /**@description 清理数据*/
    private clear() {
        this.openList.length = 0;
        this.openListMap.clear();
        this.closedListMap.clear();
        this.bronPoint = null;
        this.targetPoint = null;
        this.nowPoint = null;
    }

    /**@description 计算F值*/
    private F(p: PathPointData) {
        JPS.G(p);
        this.H(p);
        // p.F = p.G + p.H + p.K;
        p.F = p.G + p.H;
    }

    /**@description 计算到出生点的估值*/
    private static G(p: PathPointData) {
        p.G = p.parent.G + (Math.abs(p.x - p.parent.x) * 10 + Math.abs(p.y - p.parent.y) * 10);
        // if (p.parent.x === p.x || p.parent.y === p.y) {
        //     p.G = p.parent.G + 10;
        // } else {
        //     p.G = p.parent.G + 14;
        // }
    }

    /**@description 计算到目标点的估值*/
    private H(p: PathPointData) {
        p.H = Math.abs(this.targetPoint.x - p.x) * 10 + Math.abs(this.targetPoint.y - p.y) * 10;
    }
}
