import {JPS} from "./JPS";

const {ccclass, property} = cc._decorator;

@ccclass
export default class Helloworld extends cc.Component {

    @property({displayName: '地图', type: cc.Node})
    map: cc.Node = null;

    @property({displayName: '障碍物集合', type: cc.Node})
    obstacles: cc.Node = null;

    private jps: JPS = null;

    private customGenerateLogicMap() {
        window.a = this;
        let mapData = JPS.formatToMapData(this.map, this.map.children[0].width * this.map.children[0].scale);
        let autoFindPath = new JPS(mapData);
        this.jps = autoFindPath;
        //更新当前地图里所有障碍物
        for (const child of this.obstacles.children) autoFindPath.updateMap(child);
    }

    hhh() {
        let pos0 = cc.find('Canvas/起点');
        pos0.stopAllActions()
        this.unscheduleAllCallbacks()
    }
    hh() {
        this.jps.removeAllObstacle()
        for (const child of this.obstacles.children) this.jps.updateMap(child);


        this.obsP.destroyAllChildren();
        this.jps.fixClosedListMap.forEach((v,a)=>{

            let vec2s = this.jps.gridPositionConvertGameObjectPosition([cc.v2(v.x, v.y)],cc.v2(0.5, 0.5), cc.Vec2);

            let location = vec2s[0];
            let node3 = cc.instantiate(this.obs);
            node3.width = 16;
            node3.height = 16;
            this.obsP.addChild(node3)
            node3.setPosition(location)

        })


        this.searchPath();
    }

    private searchPath() {
        let pos0 = cc.find('Canvas/起点');
        let pos1 = cc.find('Canvas/终点');
        console.time('kaka')
        let paths = this.jps.gridPositionConvertGameObjectPosition(this.jps.findGridPath(pos0, pos1, 0), cc.v2(0.5, 0.5), cc.Vec2);
        console.timeEnd('kaka')
        if (paths.length === 0) console.log('死路');
        for (let i = 0; i < paths.length; i++) {
            this.scheduleOnce(() => {
                pos0.runAction(cc.moveTo(0.5, paths[i]));
            }, i * 0.5);
        }
    }

    private obsP:cc.Node;
    private obs:cc.Node;
    start() {
        let map = cc.find('Canvas/map');
        let node = map.children[0];
        node.removeFromParent();
        for (let i = 0; i < 64 * 36; i++) {
            map.addChild(cc.instantiate(node))
        }
        map.getComponent(cc.Layout).updateLayout();

        this.obs = cc.find('Canvas/obs/obs');
        this.obsP = this.obs.parent;
        this.obs.removeFromParent();


        const k = 1;

        const node1 = cc.find('Canvas/起点');
        const node2 = cc.find('Canvas/终点');
        node1.on(cc.Node.EventType.TOUCH_MOVE, function (e) {
            node1.setPosition(node1.getPosition().add(e.getDelta().mul(k)));
        });
        node2.on(cc.Node.EventType.TOUCH_MOVE, function (e) {
            node2.setPosition(node2.getPosition().add(e.getDelta().mul(k)));
        });



        map.on(cc.Node.EventType.TOUCH_START,  (e) =>{
            this.obsP.destroyAllChildren()
            this.obsP.removeAllChildren();
            //更新当前地图里所有障碍物
            if(this.jps) {
                this.jps.removeAllObstacle();
                // for (const child of this.obstacles.children) this.jps.updateMap(child);
            }
        });
        map.on(cc.Node.EventType.TOUCH_MOVE,  (e) =>{
            if(!this.jps) return;


            // for (const child of map.children) {
            //     if(child.getBoundingBoxToWorld().contains(e.getLocation())) {
            //         child
            //     }
            // }

            let location = e.getLocation().sub(cc.v2(640, 360));
            let node3 = cc.instantiate(this.obs);
            this.obsP.addChild(node3)
            node3.setPosition(location)
            // this.jps.updateMap(node3)


        });




        this.scheduleOnce(()=>{
            this.customGenerateLogicMap();
            this.searchPath();
        })

    }
}
