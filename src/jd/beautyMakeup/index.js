const Template = require('../base/template');

const {sleep, writeFileJSON, singleRun} = require('../../lib/common');
const {getMoment} = require('../../lib/moment');
const {sleepTime, diffFromNow} = require('../../lib/cron');
const webSocket = require('../../lib/webSocket');

const {common} = require('../../../charles/api');

class BeautyMakeup extends Template {
  static scriptName = 'BeautyMakeup';
  static scriptNameDesc = '美丽颜究院';
  static times = 1;
  static concurrent = true;
  static concurrentOnceDelay = 0;
  static loopHours = [7, 12, 19, 23];

  static isSuccess(data) {
    return _.property('code')(data) === '0';
  }

  static async doMain(api) {
    const self = this;

    let token = '';
    let userAgent = 'jdapp;iPhone;9.4.4;14.2;$openudid$;network/wifi;supportApplePay/0;hasUPPay/0;hasOCPay/0;model/iPhone8,1;addressid/682688717;supportBestPay/0;appBuild/167588;jdSupportDarkMode/0;Mozilla/5.0 (iPhone; CPU iPhone OS 14_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148;supportJDSHWK/1';
    // 部分任务完成情况
    let checkUpData = {};
    // 用户信息, 主要是金币
    let userData = {};
    // 店铺商品列表
    let shopProducts = {};
    // 问答
    let questionData = [];
    // 可生产的材料列表
    let produceMaterialData = {};
    let producePositionData = {
      b1: {}, b2: {}, h1: {}, h2: {}, s1: {}, s2: {},
    };
    // 可生产的产品列表
    let productList = [];
    let needSellProductId = 0;
    let sellProductMaxNum = 0;
    // 产品生产进度
    let produceProductData = [];
    // 兑换列表
    let benefitData = [];
    // 背包信息
    let packageData = {};
    // 售卖任务信息
    let sellProductData = {};
    let autoSellData = {};
    const productMaxProduceSameTimes = 4;

    await initToken();
    if (!token) return;

    const wsMsg = {
      //初始化 请求
      init: {'msg': {'type': 'action', 'args': {'source': 1}, 'action': '_init_'}},
      stats: {'msg': {'type': 'action', 'args': {'source': 'wanyiwan'}, 'action': 'stats'}},
      //签到 请求
      sign_in_1: {'msg': {'type': 'action', 'args': {}, 'action': 'sign_in'}},
      sign_in_2: {
        'msg': {
          'action': 'write',
          'type': 'action',
          'args': {'action_type': 1, 'channel': 2, 'source_app': 2},
        },
      },
      // 指引
      add_user_guide: {'msg': {'type': 'action', 'args': {'position': 1}, 'action': 'add_user_guide'}},
      //获取任务进度 请求
      check_up: {'msg': {'type': 'action', 'args': {}, 'action': 'check_up'}},
      //获取店铺及商品信息 请求
      shop_products: {'msg': {'type': 'action', 'args': {}, 'action': 'shop_products'}},
      //完成浏览会场任务 请求
      meetingplace_view: {'msg': {'type': 'action', 'args': {'source': 1}, 'action': 'meetingplace_view'}},
      //完成浏览商品任务 请求
      add_product_view_1: {'msg': {'type': 'action', 'args': {'add_product_id': 0}, 'action': 'add_product_view'}},
      add_product_view_2: {
        'msg': {
          'action': 'write',
          'type': 'action',
          'args': {'action_type': 9, 'channel': 2, 'source_app': 2, 'vender': ''},
        },
      },
      add_product_view_3: {
        'msg': {
          'action': 'write',
          'type': 'action',
          'args': {'action_type': 5, 'channel': 2, 'source_app': 2, 'vender': ''},
        },
      },
      //完成店铺浏览任务 请求
      shop_view_1: {'msg': {'type': 'action', 'args': {'shop_id': ''}, 'action': 'shop_view'}},
      shop_view_2: {
        'msg': {
          'action': 'write',
          'type': 'action',
          'args': {'action_type': 6, 'channel': 2, 'source_app': 2, 'vender': ''},
        },
      },
      //获取每日问题题目 请求
      get_question: {'msg': {'type': 'action', 'args': {}, 'action': 'get_question'}},
      //提交每日问答 请求
      submit_answer: {'msg': {'type': 'action', 'args': {'commit': {}, 'correct': 3}, 'action': 'submit_answer'}},
      //查询生产坑位信息 请求
      produce_position_info_v2: {
        'msg': {
          'type': 'action',
          'args': {'position': ''},
          'action': 'produce_position_info_v2',
        },
      },
      //新手任务 请求
      newcomer_update: {'msg': {'type': 'action', 'args': {}, 'action': 'newcomer_update'}},
      //获取生产材料列表 请求
      get_produce_material: {'msg': {'type': 'action', 'args': {}, 'action': 'get_produce_material'}},
      //收取生产材料 请求
      material_fetch_v2: {
        'msg': {
          'type': 'action',
          'args': {'position': '', 'replace_material': false},
          'action': 'material_fetch_v2',
        },
      },
      //生产材料 请求
      material_produce_v2: {
        'msg': {
          'type': 'action',
          'args': {'position': '', 'material_id': 0},
          'action': 'material_produce_v2',
        },
      },
      // 获取仓库中的材料
      get_package: {'msg': {'type': 'action', 'args': {}, 'action': 'get_package'}},
      // 获取售卖任务
      get_task: {'msg': {'type': 'action', 'args': {}, 'action': 'get_task'}},
      // 完成售卖任务
      complete_task: {'msg': {'type': 'action', 'args': {'task_id': 0}, 'action': 'complete_task'}},
      //研发产品列表 请求
      product_lists: {'msg': {'type': 'action', 'args': {'page': 1, 'num': 100}, 'action': 'product_lists'}},
      //获取正在研发产品列表 请求
      product_producing: {'msg': {'type': 'action', 'args': {}, 'action': 'product_producing'}},
      //研发产品 请求
      product_produce: {'msg': {'type': 'action', 'args': {'product_id': 0, 'amount': 0}, 'action': 'product_produce'}},
      //收取研发产品 请求
      new_product_fetch: {'msg': {'type': 'action', 'args': {'log_id': 0}, 'action': 'new_product_fetch'}},
      //三餐签到
      check_up_receive: {'msg': {'type': 'action', 'args': {'check_up_id': 0}, 'action': 'check_up_receive'}},
      //获取福利列表 请求
      get_benefit: {'msg': {'type': 'action', 'args': {}, 'action': 'get_benefit'}},
      //兑换奖品 请求
      to_exchange: {'msg': {'type': 'action', 'args': {'benefit_id': 0}, 'action': 'to_exchange'}},
      // 自动售卖
      auto_sell_index: {'msg': {'type': 'action', 'args': {}, 'action': 'auto_sell_index'}},
      // 收获金币
      collect_coins: {'msg': {'type': 'action', 'args': {}, 'action': 'collect_coins'}},
    };
    const ws = webSocket.init(`wss://xinruimz-isv.isvjcloud.com/wss/?token=${token}`, {
      headers: {
        'User-Agent': userAgent,
      },
    });
    let opened = false;
    ws.on('open', async () => {
      opened = true;
    });
    ws.on('message', onMessage);
    await afterOpen();

    async function afterOpen() {
      if (!opened) {
        await sleep(2);
        return afterOpen();
      }
      if (self.getNowHour() === 23) {
        // 定时兑换
        await handleCronExchange();
        return handleExchange();
      }
      await sendMessage(wsMsg.init);
      await sendMessage(wsMsg.stats); // TODO 该逻辑可能不需要
      await sendMessage(wsMsg.shop_products);
      await sendMessage(wsMsg.get_produce_material);
      await sendMessage(wsMsg.product_producing);
      await sendMessage(wsMsg.product_lists);
      await sendMessage(wsMsg.get_package);

      // 指引
      await handleGuide();

      // 做任务
      await handleAnswer();
      await handleCheckUpReceive();
      await meetingPlace();
      await handleViewShop();
      await handleAddProduct();

      // 生产
      await handleReceiveMaterial();
      await handleReceiveProduct();
      await handleSellProductV2();
      await handleProduceMaterial();

      // 兑换
      // await handleExchange();

      if (self.getNowHour() > 12) {
        // 最后一次才完成这个任务
        await handleDoProduceTask();
      }

      api.log(`金币为: ${userData['coins']}`);
    }

    async function initToken() {
      const targetForm = common.isvObfuscator.find(o => o.body.match('xinruimz-isv.isvjcloud.com'));
      if (!targetForm) return;
      userAgent = userAgent.replace('$openudid$', targetForm.openudid);
      const isvToken = await api.doFormBody('isvObfuscator', void 0, targetForm).then(data => {
        if (self.isSuccess(data)) return data['token'];
      });
      if (!isvToken) return;
      token = await api.doUrl('https://xinruimz-isv.isvjcloud.com/api/auth', {
        headers: {
          cookie: `IsvToken=${isvToken}`,
          origin: 'https://xinruimz-isv.isvjcloud.com',
          'User-Agent': userAgent,
        },
        body: {
          'token': isvToken,
          'source': '01',
        },
      }).then(data => _.property('access_token')(data));
    }

    async function onMessage(result) {
      if (result === 'pong') return;
      const {data, code, msg, action} = JSON.parse(result) || {};
      if (code !== 200) return api.log(`${action}请求失败, msg: ${msg}`);

      const allActions = {
        async check_up(data) {
          checkUpData = data;
        },
        async check_up_receive(data) {
          api.log('三餐签到成功');
        },
        async get_user(data) {
          userData = data;
        },
        async get_ad(data) {
          if (data['check_sign_in'] === 1) {
            await signIn();
          }
        },
        async shop_products(data) {
          shopProducts = data;
        },
        async get_question(data) {
          questionData = data;
        },
        async get_produce_material(data) {
          produceMaterialData = data;
        },
        async produce_position_info_v2(data) {
          const position = data['position'];
          producePositionData[position] = data;
        },
        async material_fetch_v2(data) {
          const position = data['position'];
          producePositionData[position] = data;
        },
        async product_producing(data) {
          produceProductData = data;
        },
        async get_package(data) {
          packageData = data;
        },
        async get_task(data) {
          sellProductData = data;
        },
        async complete_task(data) {
          api.log('售卖任务完成一次');
        },
        async product_lists(data) {
          productList = data;
        },
        async product_produce(data) {
          produceProductData = data;
        },
        async get_benefit(data) {
          benefitData = data;
        },
        async auto_sell_index(data) {
          autoSellData = data;
        },
      };
      // writeFileJSON(data, `${action}.json`, __dirname);
      allActions[action] && allActions[action](data);

      // 通用处理
      if (data['user_coins']) {
        userData['coins'] = data['user_coins'];
      }

      await sleep();
    }

    // 签到
    async function signIn() {
      await sendMessage(wsMsg.sign_in_1);
    }

    // 浏览会场
    async function meetingPlace() {
      for (let i = checkUpData['meetingplace_view']; i < checkUpData['mettingplace_count']; i++) {
        await sendMessage(wsMsg.meetingplace_view);
      }
    }

    // 三餐签到
    async function handleCheckUpReceive() {
      await sendMessage(wsMsg.check_up);
      if (_.isEmpty(checkUpData['check_up'])) return;
      const targetData = _.last(checkUpData['check_up']);
      if (targetData['receive_status'] === 1) return;
      wsMsg.check_up_receive.msg.args.check_up_id = targetData.id;
      await sendMessage(wsMsg.check_up_receive);
    }

    // 加购
    async function handleAddProduct() {
      for (let i = checkUpData['product_adds'].length; i < checkUpData['daily_product_add_times']; i++) {
        const {id} = shopProducts['products'][i];
        wsMsg.add_product_view_1.msg.args.add_product_id = id;
        await sendMessage(wsMsg.add_product_view_1);
      }
    }

    // 浏览关注店铺
    async function handleViewShop() {
      for (let i = checkUpData['shop_view'].length; i < checkUpData['daily_shop_follow_times']; i++) {
        const {id} = shopProducts['shops'][i];
        wsMsg.shop_view_1.msg.args.shop_id = id;
        await sendMessage(wsMsg.shop_view_1);
      }
    }

    async function handleGuide() {
      // TODO 完善该逻辑
      if (userData.newcomer !== 1) return;
    }

    // 每日问答
    async function handleAnswer() {
      if (checkUpData['today_answered']) return;
      await sendMessage(wsMsg.get_question);
      wsMsg.submit_answer.msg.args.commit = _.fromPairs(questionData.map(({id, answers}) => [id, +answers]));
      await sendMessage(wsMsg.submit_answer);
    }

    async function updateMaterialPositionInfo() {
      for (const position of _.keys(producePositionData)) {
        wsMsg.produce_position_info_v2.msg.args.position = position;
        await sendMessage(wsMsg.produce_position_info_v2);
      }
    }

    async function handleProduceMaterial() {
      const sellProduct = productList.find(o => o['id'] === needSellProductId);
      const mainMaterial = sellProduct ? sellProduct['product_materials'].map(o => o['material_id']) : [];
      for (const data of _.values(producePositionData)) {
        const position = data['position'];
        if (data['is_valid'] === 1 && data['valid_electric'] > 0) {
          // 可以进行生产
          const allKeys = ['special', 'high', 'base'];
          for (const key of allKeys) {
            if (position.substring(0, 1) < key.substring(0, 1)) continue;
            const materials = _.flatten(produceMaterialData[key].map(o => o.items)).filter(o => !o.isProduced);
            let material = materials.find(o => mainMaterial.includes(o['id'])) || materials[0];
            if (!material) continue;
            material.isProduced = true;
            await handleProduce(position, material.id);
            break;
          }
        }
      }

      async function handleProduce(position, materialId) {
        wsMsg.material_produce_v2.msg.args.position = position;
        wsMsg.material_produce_v2.msg.args.material_id = materialId;
        await sendMessage(wsMsg.material_produce_v2);
      }
    }

    async function handleProduceProduct(id, lackNum) {
      await sendMessage(wsMsg.get_package);
      const limitNum = lackNum || 20;
      const product = productList.find(o => o['id'] === id);
      if (!product) return false;
      const materials = product['product_materials'].map(v => {
        return packageData['material'].find(o => o['item_id'] === v['material_id']) || {num: 0};
      });
      const maxNum = getMaxProductNum(1, product['product_materials'], materials) || 0;
      if (id) {
        if (maxNum === 0) {
          // 如果当前产品不可生产, 就生产下一个
          const currentIndex = productList.findIndex(o => o['id'] === id);
          return handleProduceProduct(productList[currentIndex + 1].id, lackNum);
        }
        if (lackNum && (maxNum < lackNum)) {
          api.log(`材料不足, 不可以生产${product['name']}`);
          needSellProductId = id;
          sellProductMaxNum = maxNum;
          return false;
        }
      }
      if (!maxNum) return false;
      await handleProduceSameTime(id, maxNum);
      const producingData = produceProductData.filter(o => o['product_id'] === id);
      if (_.isEmpty(producingData)) return false;
      await keepOnline(_.max(_.map(producingData, 'expires')));
      await handleReceiveProduct();
      return true;

      function getMaxProductNum(num = 1, preList, totalList) {
        let found = false;
        for (let i = 0; i < preList.length; i++) {
          if ((preList[i]['num'] * num) > totalList[i]['num']) {
            found = true;
            return;
          }
        }
        if (found) return --num;
        if (num === limitNum) return num;
        return getMaxProductNum(++num, preList, totalList);
      }

      // 同时生产
      async function handleProduceSameTime(id, allNums) {
        wsMsg.product_produce.msg.args.product_id = id;
        let data = [];
        let i = 0;
        do {
          for (let j = 0; j < productMaxProduceSameTimes && i < allNums; j++) {
            i++;
            data[j] = data[j] || 0;
            data[j]++;
          }
        } while (i < allNums);
        for (const amount of data) {
          wsMsg.product_produce.msg.args.amount = amount;
          await sendMessage(wsMsg.product_produce);
        }
      }
    }

    // 收取生产好的材料
    async function handleReceiveMaterial() {
      await updateMaterialPositionInfo();
      for (const {position, produce_num} of _.values(producePositionData)) {
        if (produce_num === 0 || !position) continue;
        wsMsg.material_fetch_v2.msg.args.position = position;
        await sendMessage(wsMsg.material_fetch_v2);
      }
    }

    // 收取生产好的产品
    async function handleReceiveProduct(id) {
      await sendMessage(wsMsg.product_producing);
      const list = id ? produceProductData.filter(o => o['id'] === id) : produceProductData;
      for (const {id, expires} of _.concat(list)) {
        if (expires !== 0) continue;
        checkUpData['produce'] = 1;
        wsMsg.new_product_fetch.msg.args.log_id = id;
        await sendMessage(wsMsg.new_product_fetch);
      }
    }

    async function handleSellProduct() {
      await sendMessage(wsMsg.get_task);
      const lackNum = sellProductData['num'] - sellProductData['package_stock'];
      let enableCompleted = true;
      // 数量不够, 需要进行生产
      if (lackNum > 0) {
        enableCompleted = await handleProduceProduct(sellProductData['product_id'], lackNum);
      }
      if (!enableCompleted) return;
      wsMsg.complete_task.msg.args.task_id = sellProductData['id'];
      await sendMessage(wsMsg.complete_task);
      await handleSellProduct();
    }

    async function handleSellProductV2() {
      await handleProduceProduct(needSellProductId = productList[0].id);
      await sendMessage(wsMsg.auto_sell_index);
      await sleep(autoSellData['next_collect_time']);
      await handleCollectSellProduct();
    }

    async function handleCollectSellProduct() {
      await sendMessage(wsMsg.collect_coins);
    }

    // 完成产品研发任务
    async function handleDoProduceTask() {
      if (checkUpData['produce']) return;
      const id = sellProductMaxNum > 0 ? sellProductMaxNum : _.last(productList)['id'];
      await handleProduceProduct(id, 1);
    }

    async function handleCronExchange() {
      await sendMessage(wsMsg.init);
      await sendMessage(wsMsg.get_benefit);
      // 500豆
      wsMsg.to_exchange.msg.args.benefit_id = (benefitData.find(o => o['name'].match('京豆') && +o.coins === 50000) || {})['id'] || 9;
      await keepOnline(diffFromNow(24) / 1000);
      await sendMessage(wsMsg.to_exchange);
    }

    // 兑换东西
    async function handleExchange() {
      await sendMessage(wsMsg.get_benefit);
      const beanData = benefitData.filter(o => o.name.match('京豆')).reverse();
      for (const {id, day_exchange_count: times, day_limit: maxTimes, coins} of beanData) {
        wsMsg.to_exchange.msg.args.benefit_id = id;
        for (let i = times; i < maxTimes; i++) {
          if (userData['coins'] < +coins) continue;
          await sendMessage(wsMsg.to_exchange);
        }
      }
    }

    async function sendMessage(data) {
      ws.send(_.isObject(data) ? JSON.stringify(data) : data);
      await sleep();
    }

    async function keepOnline(seconds) {
      const maxSeconds = 20;
      const needLoop = seconds > maxSeconds;
      // 不需要等待
      sendMessage('ping');
      await sleep(needLoop ? maxSeconds : seconds);
      if (needLoop) {
        await keepOnline(seconds - maxSeconds);
      }
    }
  }
}

singleRun(BeautyMakeup, ['start', 'loop'], async (method, getCookieData) => {
  if (method === 'start') {
    return start();
  }
  if (method === 'loop') {
    return BeautyMakeup.loopRun(start);
  }

  async function start() {
    return BeautyMakeup.start(getCookieData());
  }
}).then();

module.exports = BeautyMakeup;
