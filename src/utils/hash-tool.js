const HashTool = {
  fastHash(obj) {
    if (!obj || typeof obj !== 'object') return String(obj);

    let str = JSON.stringify(obj).substring(0, 50);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // 轉為 32bit 整數
    }
    return hash;
  }
};

module.exports = HashTool;
