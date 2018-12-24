"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.dispatchWithLoading = dispatchWithLoading;
exports.default = void 0;

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));

var _redux = require("redux");

var _reduxDevtoolsExtension = require("redux-devtools-extension");

var _reduxSaga = _interopRequireDefault(require("redux-saga"));

var _effects = require("redux-saga/effects");

// 全局immutable组件
// 构建工具
// saga工具
var SagaMiddleware = (0, _reduxSaga.default)(); // 请求工具

/**
 * 获取store，包含：
 * [sagamiddleware]：用于执行generator
 * [reducers]：函数合并，用于合并不同model中的reducer
 * [redux(composeWithDevTools)]：用于浏览器开启redux支持
 * @param {Array | Object} model 用户的model文件 
 */

function createAppStoreForSaga(model) {
  return function (initialState) {
    var __reducers = addLoading(modelReducersToStore(model));

    var store = (0, _redux.createStore)( // 从model中，提取reducers
    (0, _redux.combineReducers)(__reducers), initialState,
    /**
    * 注意：如果你需要react-devtools而不是redux-devtools：
    * 1. 请到nw-build中的package.json修改chromium-args，
    * 2. 或者指定启动方式npm run start-nw命令中的--load-extension;
    * [目前为止，redux的作用远大于react，所以，建议开启redux就可以了] 
     */
    (0, _reduxDevtoolsExtension.composeWithDevTools)((0, _redux.applyMiddleware)(SagaMiddleware))); // 调用sagaMiddleWare的runsaga模块

    var modelEffects = startEffects(model, store.dispatch);
    var loadingEffects = startLoadingEffect();
    store.sagaTask = SagaMiddleware.run(
    /*#__PURE__*/
    _regenerator.default.mark(function _callee() {
      return _regenerator.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.next = 2;
              return (0, _effects.all)((0, _toConsumableArray2.default)(modelEffects).concat([loadingEffects]));

            case 2:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, this);
    }));
    return store;
  };
}
/**
 * model提取reducers
 * @param {Object} model 
 */


function modelReducersToStore(model, persist) {
  // 如果存在多个model则合并
  if (Object.prototype.toString.call(model) === "[object Array]") {
    var tempModels = {};

    for (var i = 0; i < model.length; i++) {
      tempModels = Object.assign(tempModels, modelReducersToStore(model[i], persist));
    }

    return tempModels;
  }

  if (!model || typeof model.state === "undefined") {
    // 此处为强制使用immutable
    // 后期可修改为配置文件
    throw new Error("model未定义或为mutable可变数据");
  }

  return (0, _defineProperty2.default)({}, model.namespace, function () {
    var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : model.state;
    var action = arguments.length > 1 ? arguments[1] : undefined;
    // 判断是否添加namespace
    checkNameSpace(action);

    var _action$type$split = action.type.split("/"),
        _action$type$split2 = (0, _slicedToArray2.default)(_action$type$split, 2),
        namespace = _action$type$split2[0],
        actionType = _action$type$split2[1]; // 是否需要清空全部store


    if (namespace === "clear") {
      switch (actionType) {
        case "all":
          return {};

        default:
          return state;
      }
    } // 检查是否为用一个命名空间，否则直接返回state


    if (namespace === model.namespace) {
      if (actionType in model.reducers) {
        var newState = model.reducers[actionType](state, action);
        return newState;
      }

      return state;
    }

    return state;
  });
}
/**
 * 启用saga的takeEvery
 * @param {Object / Array} model 来自models文件夹的数据模型 
 */


function startEffects(model, dispatch) {
  var tempEffects = [];

  if (Object.prototype.toString.call(model) === "[object Array]") {
    model.forEach(function (m) {
      return pushGeneratorArray(m, dispatch, tempEffects);
    });
  } else {
    pushGeneratorArray(model, dispatch, tempEffects);
  }

  return tempEffects;
}
/**
 * 生成generator方法
 */


function pushGeneratorArray(model, dispatch, tempEffects) {
  var efs = model.effects;
  var sub = model.subscriptions;
  var namespace = model.namespace;
  var effectList = Object.entries(efs);
  var callStacks = tempEffects; //注册effect列表

  effectList.forEach(function (effect) {
    callStacks.push((0, _effects.takeLatest)(namespace + "/" + effect[0], effect[1]));
  }); //注册路由监听列表

  if (typeof sub !== "undefined") {
    sub.forEach(function (listener) {
      if (listener.path) {
        callStacks.push((0, _effects.takeLatest)(listener.path,
        /*#__PURE__*/
        _regenerator.default.mark(function _callee2(action) {
          return _regenerator.default.wrap(function _callee2$(_context2) {
            while (1) {
              switch (_context2.prev = _context2.next) {
                case 0:
                  _context2.next = 2;
                  return (0, _effects.put)({
                    type: listener.dispatch,
                    action: action
                  });

                case 2:
                case "end":
                  return _context2.stop();
              }
            }
          }, _callee2, this);
        })));
      }

      if (listener.request) {
        callStacks.push((0, _effects.takeLatest)("request/" + listener.request,
        /*#__PURE__*/
        _regenerator.default.mark(function _callee3(action) {
          return _regenerator.default.wrap(function _callee3$(_context3) {
            while (1) {
              switch (_context3.prev = _context3.next) {
                case 0:
                  _context3.next = 2;
                  return (0, _effects.put)({
                    type: listener.dispatch,
                    action: action
                  });

                case 2:
                case "end":
                  return _context3.stop();
              }
            }
          }, _callee3, this);
        })));
      }

      if (listener.on) {
        if (typeof window !== "undefined") {
          window[listener.on] = function (e) {
            dispatch({
              type: "on/" + listener.on,
              action: e
            });
          };
        }

        callStacks.push((0, _effects.takeEvery)("on/" + listener.on,
        /*#__PURE__*/
        _regenerator.default.mark(function _callee4(action) {
          return _regenerator.default.wrap(function _callee4$(_context4) {
            while (1) {
              switch (_context4.prev = _context4.next) {
                case 0:
                  _context4.next = 2;
                  return (0, _effects.put)({
                    type: listener.dispatch,
                    action: action
                  });

                case 2:
                case "end":
                  return _context4.stop();
              }
            }
          }, _callee4, this);
        })));
      }
    });
  }
}
/**
 * 
 * @param {*} action 
 */


function startLoadingEffect() {
  // 注册loading状态
  return (0, _effects.takeEvery)("loading/insert",
  /*#__PURE__*/
  _regenerator.default.mark(function _callee5(action) {
    return _regenerator.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            _context5.next = 2;
            return (0, _effects.put)({
              type: action.action.type,
              payload: action.action.payload
            });

          case 2:
          case "end":
            return _context5.stop();
        }
      }
    }, _callee5, this);
  }));
}
/**
 * 判断命名空间
 * @param {*} action 
 */


function checkNameSpace(action) {
  if (action.type.toString().indexOf("/") === -1 && action.type.toString().indexOf("@") === -1) {
    throw new Error("dispatch\u65B9\u6CD5\u65F6\uFF0C\u5FC5\u987B\u6DFB\u52A0namespace\uFF0C\u5E76\u4F7F\u7528'/'\u5206\u5272\uFF0C\u4F8B\u5982:dispath({type:'app/getUserInfo'});\n        \u6536\u5230\u7684action:\" ".concat(action.type));
  }
}
/**
 * 添加loading
 */


function addLoading(models) {
  var newModels = Object.assign(models, {
    // loading的列表为List，防止多个tag重复
    loading: function loading() {
      var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
      var action = arguments.length > 1 ? arguments[1] : undefined;
      checkNameSpace(action);

      var _action$type$split3 = action.type.split("/"),
          _action$type$split4 = (0, _slicedToArray2.default)(_action$type$split3, 2),
          namespace = _action$type$split4[0],
          actionType = _action$type$split4[1];

      if (namespace === "loading" && actionType === "insert") {
        // 此处为两层action嵌套
        return state.concat([action.action.payload.tag]);
      }

      if (namespace === "loading" && actionType === "delete") {
        var index = state.indexOf(action.payload.tag);
        var newState = (0, _toConsumableArray2.default)(state);
        newState.splice(index, 1); // 此处为一层action嵌套

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


function dispatchWithLoading(store, action) {
  if (action && action.payload && action.payload.tag) {
    store.dispatch({
      type: "loading/insert",
      action: action
    });
  } else {
    throw "你需要填写tag";
  }
}

var _default = createAppStoreForSaga;
exports.default = _default;