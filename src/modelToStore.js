// 全局immutable组件
import { combineReducers } from "redux"

// 构建工具
import { createStore , applyMiddleware} from 'redux'
import { composeWithDevTools } from 'redux-devtools-extension'

// saga工具
import createSagaMiddleware from 'redux-saga'
import { takeEvery, put , takeLatest, all } from "redux-saga/effects"


const SagaMiddleware = createSagaMiddleware();

// 请求工具
/**
 * 获取store，包含：
 * [sagamiddleware]：用于执行generator
 * [reducers]：函数合并，用于合并不同model中的reducer
 * [redux(composeWithDevTools)]：用于浏览器开启redux支持
 * @param {Array | Object} model 用户的model文件 
 */
function createAppStoreForSaga(model) {

    return (initialState)=>{

        const __reducers = addLoading(
            modelReducersToStore(
                model
            )
        );
    
        const store = createStore(
    
            // 从model中，提取reducers
            combineReducers(
                __reducers
            )
            ,
    
            initialState
            ,
            /**
            * 注意：如果你需要react-devtools而不是redux-devtools：
            * 1. 请到nw-build中的package.json修改chromium-args，
            * 2. 或者指定启动方式npm run start-nw命令中的--load-extension;
            * [目前为止，redux的作用远大于react，所以，建议开启redux就可以了] 
             */
            composeWithDevTools(
                applyMiddleware(
                    SagaMiddleware
                )
            )
        );
    
        // 调用sagaMiddleWare的runsaga模块
        const modelEffects = startEffects(model,store.dispatch);
        const loadingEffects = startLoadingEffect();
        
        store.sagaTask = SagaMiddleware.run(function*(){
            yield all([
                ...modelEffects,
                loadingEffects
            ])
        });
        return store;
    }
}

/**
 * model提取reducers
 * @param {Object} model 
 */
function modelReducersToStore(model,persist) {

    // 如果存在多个model则合并
    if (Object.prototype.toString.call(model) === "[object Array]") {
        let tempModels = {};
        for (var i = 0; i < model.length; i++) {
            tempModels = Object.assign(tempModels, modelReducersToStore(model[i],persist));
        }
        return tempModels;
    }

    if (
        !model ||
        typeof model.state === "undefined"
    ) {

        // 此处为强制使用immutable
        // 后期可修改为配置文件
        throw new Error("model未定义或为mutable可变数据");
    }

    return {
        // 将model的命名空间插入合并为同一个reducer
        [model.namespace]: (state = model.state, action) => {

            // 判断是否添加namespace
            checkNameSpace(action);
            const [namespace, actionType] = action.type.split("/");

            // 是否需要清空全部store
            if(namespace === "clear"){
                switch (actionType){
                    case "all":
                        return {};
                    default:
                        return state;
                }
            }

            // 检查是否为用一个命名空间，否则直接返回state
            if (namespace === model.namespace) {
                if (actionType in model.reducers) {
                    const newState = model.reducers[actionType](state, action);
                    return newState;
                }
                return state;
            }
            return state;
        },
    }
}

/**
 * 启用saga的takeEvery
 * @param {Object / Array} model 来自models文件夹的数据模型 
 */
function startEffects(model,dispatch) {
    let tempEffects = [];
    if (Object.prototype.toString.call(model) === "[object Array]") {
        model.forEach(m=>pushGeneratorArray(m,dispatch,tempEffects));
    } else {
        pushGeneratorArray(model,dispatch,tempEffects);
    }
    return tempEffects;
}

/**
 * 生成generator方法
 */
function pushGeneratorArray(model,dispatch,tempEffects) {
    const efs = model.effects;
    const sub = model.subscriptions;
    const namespace = model.namespace;
    const effectList  = Object.entries(efs);
    const callStacks = tempEffects;

    //注册effect列表
    effectList.forEach(effect=>{
        callStacks.push(takeLatest(namespace + "/" + effect[0], effect[1]))
    })

    //注册路由监听列表
    if(typeof sub !== "undefined"){
        sub.forEach(listener=>{
            if(listener.path){
                callStacks.push(
                    takeLatest(listener.path, 
                        function *(action){
                            yield put({type: listener.dispatch, action})
                        }
                    )
                )
            }

            if(listener.request){
                callStacks.push(
                    takeLatest("request/" + listener.request, 
                    function *(action){
                        yield put({type: listener.dispatch, action})
                    })
                )
            }

            if(listener.on){
                if(typeof window !== "undefined"){
                    window[listener.on] = (e)=>{
                        dispatch({type: "on/" + listener.on,action: e});
                    }
                }
                callStacks.push(
                    takeEvery("on/" + listener.on, function *(action){
                        yield put({type: listener.dispatch, action})
                    })
                )
            }
        })
    }
}

/**
 * 
 * @param {*} action 
 */
function startLoadingEffect(){
    // 注册loading状态
    return takeEvery("loading/insert", function *(action){
        yield put({type: action.action.type, payload: action.action.payload})
    })
}

/**
 * 判断命名空间
 * @param {*} action 
 */
function checkNameSpace(action){
    if(action.type.toString().indexOf("/") === -1 && action.type.toString().indexOf("@") === -1){
        throw new Error(`dispatch方法时，必须添加namespace，并使用'/'分割，例如:dispath({type:'app/getUserInfo'});
        收到的action:" ${action.type}`)
    }
}

/**
 * 添加loading
 */
function addLoading(models){
    const newModels = Object.assign(models,{

        // loading的列表为List，防止多个tag重复
        loading: (state = [],action)=>{
            checkNameSpace(action);
            const [namespace, actionType] = action.type.split("/");
            if(namespace === "loading" && actionType === "insert"){

                // 此处为两层action嵌套
                return state.concat([action.action.payload.tag]);
            }

            if(namespace === "loading" && actionType === "delete"){

                const index = state.indexOf(action.payload.tag);
                const newState = [...state];
                newState.splice(index, 1);

                // 此处为一层action嵌套
                return newState;
            }
            return state;
        }
    });
    return newModels;
}

/**
 * dispatch方法
 */
function dispatchWithLoading(store,action){
    if(action && action.payload && action.payload.tag){
        store.dispatch({type:"loading/insert",action:action})
    }else{
        throw "你需要填写tag"
    }
}

export {dispatchWithLoading}

export default createAppStoreForSaga;
