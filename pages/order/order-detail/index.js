import { formatTime } from '../../../utils/util';
import { OrderStatus, LogisticsIconMap } from '../config';
import {
  fetchBusinessTime,
  fetchOrderDetail,
} from '../../../services/order/orderDetail';

// 静态资源域名
const STATIC_BASE_URL = 'https://cdn-we-retail.ym.tencent.com/miniapp/';

Page({
  data: {
    pageNav: {
      color: 'white',
      background: 'linear-gradient(90deg,#FFAB44 0%,#FF7333 100%)',
    },
    pageLoading: true,
    bgImgUrl: '',
    order: {}, // 后台返回的原始数据
    _order: {}, // 内部使用和提供给 order-card 的数据
    storeDetail: {},
    countDownTime: null,
    addressEditable: false,
    backRefresh: false, // 用于接收其他页面back时的状态
    formatCreateTime: '', //格式化订单创建时间
    logisticsNodes: [],

    /** 订单评论状态 */
    orderHasCommented: true,
  },

  onLoad(query) {
    this.orderNo = query.orderNo;
    this.init();
    this.navbar = this.selectComponent('#navbar');
    this.pullDownRefresh = this.selectComponent('#wr-pull-down-refresh');
  },

  onShow() {
    // 当从其他页面返回，并且 backRefresh 被置为 true 时，刷新数据
    if (!this.data.backRefresh) return;
    this.onRefresh();
    this.setData({ backRefresh: false });
  },

  onUnload() {
    // 没有这个函数……我先屏蔽了
    // hideError();
  },

  onPageScroll(e) {
    // this.navbar && this.navbar.methods.onScroll.call(this.navbar, e.scrollTop);
    this.pullDownRefresh && this.pullDownRefresh.onPageScroll(e);
  },

  onImgError(e) {
    if (e.detail) {
      console.error('img 加载失败');
    }
  },

  // 页面初始化，会展示pageLoading
  init() {
    this.setData({ pageLoading: true });
    this.getStoreDetail();
    this.getDetail()
      .then(() => {
        this.setData({ pageLoading: false });
      })
      .catch((e) => {
        console.error(e);
      });
  },

  // 页面刷新，展示下拉刷新
  onRefresh() {
    this.init();
    // 如果上一页为订单列表，通知其刷新数据
    const pages = getCurrentPages();
    const lastPage = pages[pages.length - 2];
    if (lastPage) {
      lastPage.data.backRefresh = true;
    }
  },

  // 页面刷新，展示下拉刷新
  onPullDownRefresh_(e) {
    const { callback } = e.detail;
    return this.getDetail().then(() => callback && callback());
  },

  getDetail() {
    const params = {
      parameter: this.orderNo,
    };
    return fetchOrderDetail(params).then((res) => {
      const order = res.data;
      const _order = {
        id: order.orderId,
        orderNo: order.orderNo,
        parentOrderNo: order.parentOrderNo,
        storeId: order.storeId,
        storeName: order.storeName,
        status: order.orderStatus,
        statusDesc: order.orderStatusName,
        amount: order.paymentAmount,
        totalAmount: order.goodsAmountApp,
        logisticsNo: order.logisticsVO.logisticsNo,
        goodsList: (order.orderItemVOs || []).map((goods) =>
          Object.assign({}, goods, {
            id: goods.id,
            thumb: goods.goodsPictureUrl,
            title: goods.goodsName,
            skuId: goods.skuId,
            spuId: goods.spuId,
            specs: (goods.specifications || []).map((s) => s.specValue),
            price: goods.tagPrice ? goods.tagPrice : goods.actualPrice, // 商品销售单价, 优先取限时活动价
            num: goods.buyQuantity,
            titlePrefixTags: goods.tagText ? [{ text: goods.tagText }] : [],
            buttons: goods.buttonVOs || [],
          }),
        ),
        buttons: order.buttonVOs || [],
        createTime: order.createTime,
        receiverAddress: this.composeAddress(order),
        groupInfoVo: order.groupInfoVo,
      };

      this.setData({
        order,
        _order,
        formatCreateTime: formatTime(
          parseFloat(`${order.createTime}`),
          'YYYY-MM-DD HH:mm',
        ), // 格式化订单创建时间
        countDownTime: this.computeCountDownTime(order),
        bgImgUrl: this.getBgImgUrl(order.orderStatus, order),
        addressEditable:
          [OrderStatus.PENDING_PAYMENT, OrderStatus.PENDING_DELIVERY].includes(
            order.orderStatus,
          ) && order.orderSubStatus !== -1, // 订单正在取消审核时不允许修改地址（但是返回的状态码与待发货一致）
        isPaid: !!order.paymentVO.paySuccessTime,
        invoiceStatus: this.datermineInvoiceStatus(order),
        invoiceDesc: order.invoiceDesc,
        logisticsNodes: this.flattenNodes(order.trajectoryVos || []),
      });
    });
  },

  // 展开物流节点
  flattenNodes(nodes) {
    return (nodes || []).reduce((res, node) => {
      return (node.nodes || []).reduce((res1, subNode, index) => {
        res1.push({
          title: index === 0 ? node.title : '', // 子节点中仅第一个显示title
          desc: subNode.status,
          date: formatTime(+subNode.timestamp, 'YYYY-MM-DD HH:mm:ss'),
          icon: index === 0 ? LogisticsIconMap[node.code] || '' : '', // 子节点中仅第一个显示icon
        });
        return res1;
      }, res);
    }, []);
  },

  datermineInvoiceStatus(order) {
    // 1-已开票
    // 2-未开票（可补开）
    // 3-未开票
    // 4-门店不支持开票
    return order.invoiceStatus;
  },

  // 拼接省市区
  composeAddress(order) {
    return [
      //order.logisticsVO.receiverProvince,
      order.logisticsVO.receiverCity,
      order.logisticsVO.receiverCounty,
      order.logisticsVO.receiverArea,
      order.logisticsVO.receiverAddress,
    ]
      .filter((s) => !!s)
      .join(' ');
  },

  getStoreDetail() {
    fetchBusinessTime().then((res) => {
      const storeDetail = {
        storeTel: res.data.telphone,
        storeBusiness: res.data.businessTime.join('\n'),
      };
      this.setData({ storeDetail });
    });
  },

  getBgImgUrl(status, order) {
    switch (status) {
      case OrderStatus.PENDING_PAYMENT:
        return `${STATIC_BASE_URL}order/bg-order-pengding-pay.png`;
      case OrderStatus.PENDING_DELIVERY:
        if (order.orderSubStatus === -1) {
          return `${STATIC_BASE_URL}order/bg-cancel-order-checking.png`;
        }
        return `${STATIC_BASE_URL}order/bg-order-packaged.png`;
      case OrderStatus.PENDING_RECEIPT:
        return `${STATIC_BASE_URL}order/bg-order-delivering.png`;
      case OrderStatus.COMPLETE:
        return `${STATIC_BASE_URL}order/bg-order-finished.png`;
      case OrderStatus.PAYMENT_TIMEOUT:
        return `${STATIC_BASE_URL}order/bg-order-canceled.png`;
      case OrderStatus.CANCELED_NOT_PAYMENT:
        return `${STATIC_BASE_URL}order/bg-order-canceled.png`;
      case OrderStatus.CANCELED_PAYMENT:
        return `${STATIC_BASE_URL}order/bg-order-canceled.png`;
      case OrderStatus.CANCELED_REJECTION:
        return `${STATIC_BASE_URL}order/bg-order-canceled.png`;
      default:
        return `${STATIC_BASE_URL}order/bg-order-pengding-pay.png`;
    }
  },

  // 仅对待支付状态计算付款倒计时
  // 返回时间若是大于2020.01.01，说明返回的是关闭时间，否则说明返回的直接就是剩余时间
  computeCountDownTime(order) {
    if (order.orderStatus !== OrderStatus.PENDING_PAYMENT) return null;
    return order.autoCancelTime > 1577808000000
      ? order.autoCancelTime - Date.now()
      : order.autoCancelTime;
  },

  onCountDownFinish() {
    //this.setData({ countDownTime: -1 });
    const { countDownTime, order } = this.data;
    if (
      countDownTime > 0 ||
      (order && order.groupInfoVo && order.groupInfoVo.residueTime > 0)
    ) {
      this.onRefresh();
    }
  },

  onGoodsCardTap(e) {
    const { index } = e.currentTarget.dataset;
    const goods = this.data.order.orderItemVOs[index];
    wx.navigateTo({ url: `/pages/goods/details/index?spuId=${goods.spuId}` });
  },

  onEditAddressTap() {
    const params = {
      orderNo: this.data.order.orderNo,
      receiverAddressId: this.data.order.logisticsVO.receiverAddressId,
      cityCode: this.data.order.logisticsVO.cityCode,
      countyCode: this.data.order.logisticsVO.countyCode,
      latitude: this.data.order.logisticsVO.receiverLatitude,
      longitude: this.data.order.logisticsVO.receiverLongitude,
      provinceCode: this.data.order.logisticsVO.provinceCode,
      receiverAddress: this.data.order.logisticsVO.receiverAddress,
    };
    const paramsStr = Object.keys(params)
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    wx.navigateTo({ url: `/pages/usercenter/address/list/index?${paramsStr}` });
  },

  onOrderNumCopy() {
    wx.setClipboardData({
      data: this.data.order.orderNo,
    });
  },

  onDeliveryNumCopy() {
    wx.setClipboardData({
      data: this.data.order.logisticsVO.logisticsNo,
    });
  },

  onToInvoice() {
    wx.navigateTo({ url: `pages/order/invoice/index?id=1` });
  },

  onSuppleMentInvoice() {
    wx.navigateTo({
      url: `/pages/order/receipt/index?orderNo=${this.data._order.orderNo}`,
    });
  },

  onDeliveryClick() {
    const logisticsData = {
      nodes: this.data.logisticsNodes,
      company: this.data.order.logisticsVO.logisticsCompanyName,
      logisticsNo: this.data.order.logisticsVO.logisticsNo,
      phoneNumber: this.data.order.logisticsVO.logisticsCompanyTel,
    };
    wx.navigateTo({
      url: `/pages/order/delivery-detail/index?data=${encodeURIComponent(
        JSON.stringify(logisticsData),
      )}`,
    });
  },

  /** 跳转订单评价 */
  navToCommentCreate() {
    wx.navigateTo({
      url: `/pages/order/createComment/index?orderNo=${this.orderNo}`,
    });
  },

  /** 跳转拼团详情/分享页*/
  toGrouponDetail() {
    const {
      groupInfoVo: { promotionId, groupId },
      storeId,
    } = this.data.order;
    wx.showToast({ title: '点击了拼团' });
    /* wx.navigateTo({
      url: `/groupon/detail/index?promotionId=${promotionId}&groupId=${groupId}&storeId=${storeId}`,
    }); */
  },

  goBack() {
    wx.navigateTo({
      url: `/pages/order/order-list/index`,
    });
  },
});
