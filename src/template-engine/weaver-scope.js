const HashTool = require('../utils/hash-tool');
const WeaverDocument = require('../models/weaver-document');

class WeaverScope {
  constructor({ selfDoc, hostDoc, contextDoc, currentDoc, resolver, self, host, context, current, depth, hasUnresolved }) {
    this.resolver = resolver;

    const wrap = (val) => {
      if (!val) return null;
      if (val instanceof WeaverDocument) return val;
      return new WeaverDocument(val, resolver?.config);
    };

    this.selfDoc = wrap(selfDoc) || wrap(self);
    this.hostDoc = wrap(hostDoc) || wrap(host) || null;
    this.contextDoc = wrap(contextDoc) || wrap(context) || null;
    this.currentDoc = wrap(currentDoc) || wrap(current) || null;

    this.self = this.selfDoc?.raw || null;
    this.host = this.hostDoc?.raw || null;
    this.context = this.contextDoc?.raw || null;
    this.current = this.currentDoc?.raw || null;

    this.depth = depth || 0;
    this.hasUnresolved = hasUnresolved || false;
  }

  derive(newSelf = this.selfDoc, newContext = this.contextDoc, newCurrent = this.currentDoc, newHost = this.hostDoc) {
    return new WeaverScope({
      selfDoc: newSelf,
      hostDoc: newHost,
      contextDoc: newContext,
      currentDoc: newCurrent,
      resolver: this.resolver,
      depth: this.depth,
      hasUnresolved: this.hasUnresolved
    });
  }

  resolve(text, allowStructural = false) {
    return this.resolver.resolve(text, this, allowStructural);
  }

  getSignature() {
    const hash = (obj) => HashTool.fastHash(obj);
    return `${hash(this.self)}|${hash(this.context)}|${hash(this.host)}|${hash(this.current)}`;
  }
}

module.exports = WeaverScope;
