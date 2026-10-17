import {createRequire as __createRequire} from 'node:module';const require=__createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x2) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x2, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x2)(function(x2) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x2 + '" is not supported');
});
var __commonJS = (cb, mod2) => function __require2() {
  try {
    return mod2 || (0, cb[__getOwnPropNames(cb)[0]])((mod2 = { exports: {} }).exports, mod2), mod2.exports;
  } catch (e) {
    throw mod2 = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod2, isNodeMode, target) => (target = mod2 != null ? __create(__getProtoOf(mod2)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod2 || !mod2.__esModule ? __defProp(target, "default", { value: mod2, enumerable: true }) : target,
  mod2
));

// node_modules/busboy/lib/utils.js
var require_utils = __commonJS({
  "node_modules/busboy/lib/utils.js"(exports2, module) {
    "use strict";
    function parseContentType(str) {
      if (str.length === 0)
        return;
      const params = /* @__PURE__ */ Object.create(null);
      let i2 = 0;
      for (; i2 < str.length; ++i2) {
        const code = str.charCodeAt(i2);
        if (TOKEN[code] !== 1) {
          if (code !== 47 || i2 === 0)
            return;
          break;
        }
      }
      if (i2 === str.length)
        return;
      const type = str.slice(0, i2).toLowerCase();
      const subtypeStart = ++i2;
      for (; i2 < str.length; ++i2) {
        const code = str.charCodeAt(i2);
        if (TOKEN[code] !== 1) {
          if (i2 === subtypeStart)
            return;
          if (parseContentTypeParams(str, i2, params) === void 0)
            return;
          break;
        }
      }
      if (i2 === subtypeStart)
        return;
      const subtype = str.slice(subtypeStart, i2).toLowerCase();
      return { type, subtype, params };
    }
    function parseContentTypeParams(str, i2, params) {
      while (i2 < str.length) {
        for (; i2 < str.length; ++i2) {
          const code = str.charCodeAt(i2);
          if (code !== 32 && code !== 9)
            break;
        }
        if (i2 === str.length)
          break;
        if (str.charCodeAt(i2++) !== 59)
          return;
        for (; i2 < str.length; ++i2) {
          const code = str.charCodeAt(i2);
          if (code !== 32 && code !== 9)
            break;
        }
        if (i2 === str.length)
          return;
        let name;
        const nameStart = i2;
        for (; i2 < str.length; ++i2) {
          const code = str.charCodeAt(i2);
          if (TOKEN[code] !== 1) {
            if (code !== 61)
              return;
            break;
          }
        }
        if (i2 === str.length)
          return;
        name = str.slice(nameStart, i2);
        ++i2;
        if (i2 === str.length)
          return;
        let value = "";
        let valueStart;
        if (str.charCodeAt(i2) === 34) {
          valueStart = ++i2;
          let escaping = false;
          for (; i2 < str.length; ++i2) {
            const code = str.charCodeAt(i2);
            if (code === 92) {
              if (escaping) {
                valueStart = i2;
                escaping = false;
              } else {
                value += str.slice(valueStart, i2);
                escaping = true;
              }
              continue;
            }
            if (code === 34) {
              if (escaping) {
                valueStart = i2;
                escaping = false;
                continue;
              }
              value += str.slice(valueStart, i2);
              break;
            }
            if (escaping) {
              valueStart = i2 - 1;
              escaping = false;
            }
            if (QDTEXT[code] !== 1)
              return;
          }
          if (i2 === str.length)
            return;
          ++i2;
        } else {
          valueStart = i2;
          for (; i2 < str.length; ++i2) {
            const code = str.charCodeAt(i2);
            if (TOKEN[code] !== 1) {
              if (i2 === valueStart)
                return;
              break;
            }
          }
          value = str.slice(valueStart, i2);
        }
        name = name.toLowerCase();
        if (params[name] === void 0)
          params[name] = value;
      }
      return params;
    }
    function parseDisposition(str, defDecoder) {
      if (str.length === 0)
        return;
      const params = /* @__PURE__ */ Object.create(null);
      let i2 = 0;
      for (; i2 < str.length; ++i2) {
        const code = str.charCodeAt(i2);
        if (TOKEN[code] !== 1) {
          if (parseDispositionParams(str, i2, params, defDecoder) === void 0)
            return;
          break;
        }
      }
      const type = str.slice(0, i2).toLowerCase();
      return { type, params };
    }
    function parseDispositionParams(str, i2, params, defDecoder) {
      while (i2 < str.length) {
        for (; i2 < str.length; ++i2) {
          const code = str.charCodeAt(i2);
          if (code !== 32 && code !== 9)
            break;
        }
        if (i2 === str.length)
          break;
        if (str.charCodeAt(i2++) !== 59)
          return;
        for (; i2 < str.length; ++i2) {
          const code = str.charCodeAt(i2);
          if (code !== 32 && code !== 9)
            break;
        }
        if (i2 === str.length)
          return;
        let name;
        const nameStart = i2;
        for (; i2 < str.length; ++i2) {
          const code = str.charCodeAt(i2);
          if (TOKEN[code] !== 1) {
            if (code === 61)
              break;
            return;
          }
        }
        if (i2 === str.length)
          return;
        let value = "";
        let valueStart;
        let charset;
        name = str.slice(nameStart, i2);
        if (name.charCodeAt(name.length - 1) === 42) {
          const charsetStart = ++i2;
          for (; i2 < str.length; ++i2) {
            const code = str.charCodeAt(i2);
            if (CHARSET[code] !== 1) {
              if (code !== 39)
                return;
              break;
            }
          }
          if (i2 === str.length)
            return;
          charset = str.slice(charsetStart, i2);
          ++i2;
          for (; i2 < str.length; ++i2) {
            const code = str.charCodeAt(i2);
            if (code === 39)
              break;
          }
          if (i2 === str.length)
            return;
          ++i2;
          if (i2 === str.length)
            return;
          valueStart = i2;
          let encode = 0;
          for (; i2 < str.length; ++i2) {
            const code = str.charCodeAt(i2);
            if (EXTENDED_VALUE[code] !== 1) {
              if (code === 37) {
                let hexUpper;
                let hexLower;
                if (i2 + 2 < str.length && (hexUpper = HEX_VALUES[str.charCodeAt(i2 + 1)]) !== -1 && (hexLower = HEX_VALUES[str.charCodeAt(i2 + 2)]) !== -1) {
                  const byteVal = (hexUpper << 4) + hexLower;
                  value += str.slice(valueStart, i2);
                  value += String.fromCharCode(byteVal);
                  i2 += 2;
                  valueStart = i2 + 1;
                  if (byteVal >= 128)
                    encode = 2;
                  else if (encode === 0)
                    encode = 1;
                  continue;
                }
                return;
              }
              break;
            }
          }
          value += str.slice(valueStart, i2);
          value = convertToUTF8(value, charset, encode);
          if (value === void 0)
            return;
        } else {
          ++i2;
          if (i2 === str.length)
            return;
          if (str.charCodeAt(i2) === 34) {
            valueStart = ++i2;
            let escaping = false;
            for (; i2 < str.length; ++i2) {
              const code = str.charCodeAt(i2);
              if (code === 92) {
                if (escaping) {
                  valueStart = i2;
                  escaping = false;
                } else {
                  value += str.slice(valueStart, i2);
                  escaping = true;
                }
                continue;
              }
              if (code === 34) {
                if (escaping) {
                  valueStart = i2;
                  escaping = false;
                  continue;
                }
                value += str.slice(valueStart, i2);
                break;
              }
              if (escaping) {
                valueStart = i2 - 1;
                escaping = false;
              }
              if (QDTEXT[code] !== 1)
                return;
            }
            if (i2 === str.length)
              return;
            ++i2;
          } else {
            valueStart = i2;
            for (; i2 < str.length; ++i2) {
              const code = str.charCodeAt(i2);
              if (TOKEN[code] !== 1) {
                if (i2 === valueStart)
                  return;
                break;
              }
            }
            value = str.slice(valueStart, i2);
          }
          value = defDecoder(value, 2);
          if (value === void 0)
            return;
        }
        name = name.toLowerCase();
        if (params[name] === void 0)
          params[name] = value;
      }
      return params;
    }
    function getDecoder(charset) {
      let lc;
      while (true) {
        switch (charset) {
          case "utf-8":
          case "utf8":
            return decoders.utf8;
          case "latin1":
          case "ascii":
          // TODO: Make these a separate, strict decoder?
          case "us-ascii":
          case "iso-8859-1":
          case "iso8859-1":
          case "iso88591":
          case "iso_8859-1":
          case "windows-1252":
          case "iso_8859-1:1987":
          case "cp1252":
          case "x-cp1252":
            return decoders.latin1;
          case "utf16le":
          case "utf-16le":
          case "ucs2":
          case "ucs-2":
            return decoders.utf16le;
          case "base64":
            return decoders.base64;
          default:
            if (lc === void 0) {
              lc = true;
              charset = charset.toLowerCase();
              continue;
            }
            return decoders.other.bind(charset);
        }
      }
    }
    var decoders = {
      utf8: (data, hint) => {
        if (data.length === 0)
          return "";
        if (typeof data === "string") {
          if (hint < 2)
            return data;
          data = Buffer.from(data, "latin1");
        }
        return data.utf8Slice(0, data.length);
      },
      latin1: (data, hint) => {
        if (data.length === 0)
          return "";
        if (typeof data === "string")
          return data;
        return data.latin1Slice(0, data.length);
      },
      utf16le: (data, hint) => {
        if (data.length === 0)
          return "";
        if (typeof data === "string")
          data = Buffer.from(data, "latin1");
        return data.ucs2Slice(0, data.length);
      },
      base64: (data, hint) => {
        if (data.length === 0)
          return "";
        if (typeof data === "string")
          data = Buffer.from(data, "latin1");
        return data.base64Slice(0, data.length);
      },
      other: (data, hint) => {
        if (data.length === 0)
          return "";
        if (typeof data === "string")
          data = Buffer.from(data, "latin1");
        try {
          const decoder = new TextDecoder(exports2);
          return decoder.decode(data);
        } catch {
        }
      }
    };
    function convertToUTF8(data, charset, hint) {
      const decode = getDecoder(charset);
      if (decode)
        return decode(data, hint);
    }
    function basename(path6) {
      if (typeof path6 !== "string")
        return "";
      for (let i2 = path6.length - 1; i2 >= 0; --i2) {
        switch (path6.charCodeAt(i2)) {
          case 47:
          // '/'
          case 92:
            path6 = path6.slice(i2 + 1);
            return path6 === ".." || path6 === "." ? "" : path6;
        }
      }
      return path6 === ".." || path6 === "." ? "" : path6;
    }
    var TOKEN = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ];
    var QDTEXT = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1
    ];
    var CHARSET = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      1,
      0,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ];
    var EXTENDED_VALUE = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      1,
      1,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      1,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ];
    var HEX_VALUES = [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      10,
      11,
      12,
      13,
      14,
      15,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      10,
      11,
      12,
      13,
      14,
      15,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ];
    module.exports = {
      basename,
      convertToUTF8,
      getDecoder,
      parseContentType,
      parseDisposition
    };
  }
});

// node_modules/streamsearch/lib/sbmh.js
var require_sbmh = __commonJS({
  "node_modules/streamsearch/lib/sbmh.js"(exports2, module) {
    "use strict";
    function memcmp(buf1, pos1, buf2, pos2, num) {
      for (let i2 = 0; i2 < num; ++i2) {
        if (buf1[pos1 + i2] !== buf2[pos2 + i2])
          return false;
      }
      return true;
    }
    var SBMH = class {
      constructor(needle, cb) {
        if (typeof cb !== "function")
          throw new Error("Missing match callback");
        if (typeof needle === "string")
          needle = Buffer.from(needle);
        else if (!Buffer.isBuffer(needle))
          throw new Error(`Expected Buffer for needle, got ${typeof needle}`);
        const needleLen = needle.length;
        this.maxMatches = Infinity;
        this.matches = 0;
        this._cb = cb;
        this._lookbehindSize = 0;
        this._needle = needle;
        this._bufPos = 0;
        this._lookbehind = Buffer.allocUnsafe(needleLen);
        this._occ = [
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen,
          needleLen
        ];
        if (needleLen > 1) {
          for (let i2 = 0; i2 < needleLen - 1; ++i2)
            this._occ[needle[i2]] = needleLen - 1 - i2;
        }
      }
      reset() {
        this.matches = 0;
        this._lookbehindSize = 0;
        this._bufPos = 0;
      }
      push(chunk, pos) {
        let result;
        if (!Buffer.isBuffer(chunk))
          chunk = Buffer.from(chunk, "latin1");
        const chunkLen = chunk.length;
        this._bufPos = pos || 0;
        while (result !== chunkLen && this.matches < this.maxMatches)
          result = feed(this, chunk);
        return result;
      }
      destroy() {
        const lbSize = this._lookbehindSize;
        if (lbSize)
          this._cb(false, this._lookbehind, 0, lbSize, false);
        this.reset();
      }
    };
    function feed(self, data) {
      const len = data.length;
      const needle = self._needle;
      const needleLen = needle.length;
      let pos = -self._lookbehindSize;
      const lastNeedleCharPos = needleLen - 1;
      const lastNeedleChar = needle[lastNeedleCharPos];
      const end = len - needleLen;
      const occ = self._occ;
      const lookbehind = self._lookbehind;
      if (pos < 0) {
        while (pos < 0 && pos <= end) {
          const nextPos = pos + lastNeedleCharPos;
          const ch = nextPos < 0 ? lookbehind[self._lookbehindSize + nextPos] : data[nextPos];
          if (ch === lastNeedleChar && matchNeedle(self, data, pos, lastNeedleCharPos)) {
            self._lookbehindSize = 0;
            ++self.matches;
            if (pos > -self._lookbehindSize)
              self._cb(true, lookbehind, 0, self._lookbehindSize + pos, false);
            else
              self._cb(true, void 0, 0, 0, true);
            return self._bufPos = pos + needleLen;
          }
          pos += occ[ch];
        }
        while (pos < 0 && !matchNeedle(self, data, pos, len - pos))
          ++pos;
        if (pos < 0) {
          const bytesToCutOff = self._lookbehindSize + pos;
          if (bytesToCutOff > 0) {
            self._cb(false, lookbehind, 0, bytesToCutOff, false);
          }
          self._lookbehindSize -= bytesToCutOff;
          lookbehind.copy(lookbehind, 0, bytesToCutOff, self._lookbehindSize);
          lookbehind.set(data, self._lookbehindSize);
          self._lookbehindSize += len;
          self._bufPos = len;
          return len;
        }
        self._cb(false, lookbehind, 0, self._lookbehindSize, false);
        self._lookbehindSize = 0;
      }
      pos += self._bufPos;
      const firstNeedleChar = needle[0];
      while (pos <= end) {
        const ch = data[pos + lastNeedleCharPos];
        if (ch === lastNeedleChar && data[pos] === firstNeedleChar && memcmp(needle, 0, data, pos, lastNeedleCharPos)) {
          ++self.matches;
          if (pos > 0)
            self._cb(true, data, self._bufPos, pos, true);
          else
            self._cb(true, void 0, 0, 0, true);
          return self._bufPos = pos + needleLen;
        }
        pos += occ[ch];
      }
      while (pos < len) {
        if (data[pos] !== firstNeedleChar || !memcmp(data, pos, needle, 0, len - pos)) {
          ++pos;
          continue;
        }
        data.copy(lookbehind, 0, pos, len);
        self._lookbehindSize = len - pos;
        break;
      }
      if (pos > 0)
        self._cb(false, data, self._bufPos, pos < len ? pos : len, true);
      self._bufPos = len;
      return len;
    }
    function matchNeedle(self, data, pos, len) {
      const lb = self._lookbehind;
      const lbSize = self._lookbehindSize;
      const needle = self._needle;
      for (let i2 = 0; i2 < len; ++i2, ++pos) {
        const ch = pos < 0 ? lb[lbSize + pos] : data[pos];
        if (ch !== needle[i2])
          return false;
      }
      return true;
    }
    module.exports = SBMH;
  }
});

// node_modules/busboy/lib/types/multipart.js
var require_multipart = __commonJS({
  "node_modules/busboy/lib/types/multipart.js"(exports2, module) {
    "use strict";
    var { Readable, Writable } = __require("stream");
    var StreamSearch = require_sbmh();
    var {
      basename,
      convertToUTF8,
      getDecoder,
      parseContentType,
      parseDisposition
    } = require_utils();
    var BUF_CRLF = Buffer.from("\r\n");
    var BUF_CR = Buffer.from("\r");
    var BUF_DASH = Buffer.from("-");
    function noop() {
    }
    var MAX_HEADER_PAIRS = 2e3;
    var MAX_HEADER_SIZE = 16 * 1024;
    var HPARSER_NAME = 0;
    var HPARSER_PRE_OWS = 1;
    var HPARSER_VALUE = 2;
    var HeaderParser = class {
      constructor(cb) {
        this.header = /* @__PURE__ */ Object.create(null);
        this.pairCount = 0;
        this.byteCount = 0;
        this.state = HPARSER_NAME;
        this.name = "";
        this.value = "";
        this.crlf = 0;
        this.cb = cb;
      }
      reset() {
        this.header = /* @__PURE__ */ Object.create(null);
        this.pairCount = 0;
        this.byteCount = 0;
        this.state = HPARSER_NAME;
        this.name = "";
        this.value = "";
        this.crlf = 0;
      }
      push(chunk, pos, end) {
        let start = pos;
        while (pos < end) {
          switch (this.state) {
            case HPARSER_NAME: {
              let done = false;
              for (; pos < end; ++pos) {
                if (this.byteCount === MAX_HEADER_SIZE)
                  return -1;
                ++this.byteCount;
                const code = chunk[pos];
                if (TOKEN[code] !== 1) {
                  if (code !== 58)
                    return -1;
                  this.name += chunk.latin1Slice(start, pos);
                  if (this.name.length === 0)
                    return -1;
                  ++pos;
                  done = true;
                  this.state = HPARSER_PRE_OWS;
                  break;
                }
              }
              if (!done) {
                this.name += chunk.latin1Slice(start, pos);
                break;
              }
            }
            case HPARSER_PRE_OWS: {
              let done = false;
              for (; pos < end; ++pos) {
                if (this.byteCount === MAX_HEADER_SIZE)
                  return -1;
                ++this.byteCount;
                const code = chunk[pos];
                if (code !== 32 && code !== 9) {
                  start = pos;
                  done = true;
                  this.state = HPARSER_VALUE;
                  break;
                }
              }
              if (!done)
                break;
            }
            case HPARSER_VALUE:
              switch (this.crlf) {
                case 0:
                  for (; pos < end; ++pos) {
                    if (this.byteCount === MAX_HEADER_SIZE)
                      return -1;
                    ++this.byteCount;
                    const code = chunk[pos];
                    if (FIELD_VCHAR[code] !== 1) {
                      if (code !== 13)
                        return -1;
                      ++this.crlf;
                      break;
                    }
                  }
                  this.value += chunk.latin1Slice(start, pos++);
                  break;
                case 1:
                  if (this.byteCount === MAX_HEADER_SIZE)
                    return -1;
                  ++this.byteCount;
                  if (chunk[pos++] !== 10)
                    return -1;
                  ++this.crlf;
                  break;
                case 2: {
                  if (this.byteCount === MAX_HEADER_SIZE)
                    return -1;
                  ++this.byteCount;
                  const code = chunk[pos];
                  if (code === 32 || code === 9) {
                    start = pos;
                    this.crlf = 0;
                  } else {
                    if (++this.pairCount < MAX_HEADER_PAIRS) {
                      this.name = this.name.toLowerCase();
                      if (this.header[this.name] === void 0)
                        this.header[this.name] = [this.value];
                      else
                        this.header[this.name].push(this.value);
                    }
                    if (code === 13) {
                      ++this.crlf;
                      ++pos;
                    } else {
                      start = pos;
                      this.crlf = 0;
                      this.state = HPARSER_NAME;
                      this.name = "";
                      this.value = "";
                    }
                  }
                  break;
                }
                case 3: {
                  if (this.byteCount === MAX_HEADER_SIZE)
                    return -1;
                  ++this.byteCount;
                  if (chunk[pos++] !== 10)
                    return -1;
                  const header = this.header;
                  this.reset();
                  this.cb(header);
                  return pos;
                }
              }
              break;
          }
        }
        return pos;
      }
    };
    var FileStream = class extends Readable {
      constructor(opts, owner) {
        super(opts);
        this.truncated = false;
        this._readcb = null;
        this.once("end", () => {
          this._read();
          if (--owner._fileEndsLeft === 0 && owner._finalcb) {
            const cb = owner._finalcb;
            owner._finalcb = null;
            process.nextTick(cb);
          }
        });
      }
      _read(n) {
        const cb = this._readcb;
        if (cb) {
          this._readcb = null;
          cb();
        }
      }
    };
    var ignoreData = {
      push: (chunk, pos) => {
      },
      destroy: () => {
      }
    };
    function callAndUnsetCb(self, err2) {
      const cb = self._writecb;
      self._writecb = null;
      if (err2)
        self.destroy(err2);
      else if (cb)
        cb();
    }
    function nullDecoder(val, hint) {
      return val;
    }
    var Multipart = class extends Writable {
      constructor(cfg) {
        const streamOpts = {
          autoDestroy: true,
          emitClose: true,
          highWaterMark: typeof cfg.highWaterMark === "number" ? cfg.highWaterMark : void 0
        };
        super(streamOpts);
        if (!cfg.conType.params || typeof cfg.conType.params.boundary !== "string")
          throw new Error("Multipart: Boundary not found");
        const boundary = cfg.conType.params.boundary;
        const paramDecoder = typeof cfg.defParamCharset === "string" && cfg.defParamCharset ? getDecoder(cfg.defParamCharset) : nullDecoder;
        const defCharset = cfg.defCharset || "utf8";
        const preservePath = cfg.preservePath;
        const fileOpts = {
          autoDestroy: true,
          emitClose: true,
          highWaterMark: typeof cfg.fileHwm === "number" ? cfg.fileHwm : void 0
        };
        const limits = cfg.limits;
        const fieldSizeLimit = limits && typeof limits.fieldSize === "number" ? limits.fieldSize : 1 * 1024 * 1024;
        const fileSizeLimit = limits && typeof limits.fileSize === "number" ? limits.fileSize : Infinity;
        const filesLimit = limits && typeof limits.files === "number" ? limits.files : Infinity;
        const fieldsLimit = limits && typeof limits.fields === "number" ? limits.fields : Infinity;
        const partsLimit = limits && typeof limits.parts === "number" ? limits.parts : Infinity;
        let parts = -1;
        let fields = 0;
        let files = 0;
        let skipPart = false;
        this._fileEndsLeft = 0;
        this._fileStream = void 0;
        this._complete = false;
        let fileSize = 0;
        let field;
        let fieldSize = 0;
        let partCharset;
        let partEncoding;
        let partType;
        let partName;
        let partTruncated = false;
        let hitFilesLimit = false;
        let hitFieldsLimit = false;
        this._hparser = null;
        const hparser = new HeaderParser((header) => {
          this._hparser = null;
          skipPart = false;
          partType = "text/plain";
          partCharset = defCharset;
          partEncoding = "7bit";
          partName = void 0;
          partTruncated = false;
          let filename;
          if (!header["content-disposition"]) {
            skipPart = true;
            return;
          }
          const disp = parseDisposition(
            header["content-disposition"][0],
            paramDecoder
          );
          if (!disp || disp.type !== "form-data") {
            skipPart = true;
            return;
          }
          if (disp.params) {
            if (disp.params.name)
              partName = disp.params.name;
            if (disp.params["filename*"])
              filename = disp.params["filename*"];
            else if (disp.params.filename)
              filename = disp.params.filename;
            if (filename !== void 0 && !preservePath)
              filename = basename(filename);
          }
          if (header["content-type"]) {
            const conType = parseContentType(header["content-type"][0]);
            if (conType) {
              partType = `${conType.type}/${conType.subtype}`;
              if (conType.params && typeof conType.params.charset === "string")
                partCharset = conType.params.charset.toLowerCase();
            }
          }
          if (header["content-transfer-encoding"])
            partEncoding = header["content-transfer-encoding"][0].toLowerCase();
          if (partType === "application/octet-stream" || filename !== void 0) {
            if (files === filesLimit) {
              if (!hitFilesLimit) {
                hitFilesLimit = true;
                this.emit("filesLimit");
              }
              skipPart = true;
              return;
            }
            ++files;
            if (this.listenerCount("file") === 0) {
              skipPart = true;
              return;
            }
            fileSize = 0;
            this._fileStream = new FileStream(fileOpts, this);
            ++this._fileEndsLeft;
            this.emit(
              "file",
              partName,
              this._fileStream,
              {
                filename,
                encoding: partEncoding,
                mimeType: partType
              }
            );
          } else {
            if (fields === fieldsLimit) {
              if (!hitFieldsLimit) {
                hitFieldsLimit = true;
                this.emit("fieldsLimit");
              }
              skipPart = true;
              return;
            }
            ++fields;
            if (this.listenerCount("field") === 0) {
              skipPart = true;
              return;
            }
            field = [];
            fieldSize = 0;
          }
        });
        let matchPostBoundary = 0;
        const ssCb = (isMatch, data, start, end, isDataSafe) => {
          retrydata:
            while (data) {
              if (this._hparser !== null) {
                const ret = this._hparser.push(data, start, end);
                if (ret === -1) {
                  this._hparser = null;
                  hparser.reset();
                  this.emit("error", new Error("Malformed part header"));
                  break;
                }
                start = ret;
              }
              if (start === end)
                break;
              if (matchPostBoundary !== 0) {
                if (matchPostBoundary === 1) {
                  switch (data[start]) {
                    case 45:
                      matchPostBoundary = 2;
                      ++start;
                      break;
                    case 13:
                      matchPostBoundary = 3;
                      ++start;
                      break;
                    default:
                      matchPostBoundary = 0;
                  }
                  if (start === end)
                    return;
                }
                if (matchPostBoundary === 2) {
                  matchPostBoundary = 0;
                  if (data[start] === 45) {
                    this._complete = true;
                    this._bparser = ignoreData;
                    return;
                  }
                  const writecb = this._writecb;
                  this._writecb = noop;
                  ssCb(false, BUF_DASH, 0, 1, false);
                  this._writecb = writecb;
                } else if (matchPostBoundary === 3) {
                  matchPostBoundary = 0;
                  if (data[start] === 10) {
                    ++start;
                    if (parts >= partsLimit)
                      break;
                    this._hparser = hparser;
                    if (start === end)
                      break;
                    continue retrydata;
                  } else {
                    const writecb = this._writecb;
                    this._writecb = noop;
                    ssCb(false, BUF_CR, 0, 1, false);
                    this._writecb = writecb;
                  }
                }
              }
              if (!skipPart) {
                if (this._fileStream) {
                  let chunk;
                  const actualLen = Math.min(end - start, fileSizeLimit - fileSize);
                  if (!isDataSafe) {
                    chunk = Buffer.allocUnsafe(actualLen);
                    data.copy(chunk, 0, start, start + actualLen);
                  } else {
                    chunk = data.slice(start, start + actualLen);
                  }
                  fileSize += chunk.length;
                  if (fileSize === fileSizeLimit) {
                    if (chunk.length > 0)
                      this._fileStream.push(chunk);
                    this._fileStream.emit("limit");
                    this._fileStream.truncated = true;
                    skipPart = true;
                  } else if (!this._fileStream.push(chunk)) {
                    if (this._writecb)
                      this._fileStream._readcb = this._writecb;
                    this._writecb = null;
                  }
                } else if (field !== void 0) {
                  let chunk;
                  const actualLen = Math.min(
                    end - start,
                    fieldSizeLimit - fieldSize
                  );
                  if (!isDataSafe) {
                    chunk = Buffer.allocUnsafe(actualLen);
                    data.copy(chunk, 0, start, start + actualLen);
                  } else {
                    chunk = data.slice(start, start + actualLen);
                  }
                  fieldSize += actualLen;
                  field.push(chunk);
                  if (fieldSize === fieldSizeLimit) {
                    skipPart = true;
                    partTruncated = true;
                  }
                }
              }
              break;
            }
          if (isMatch) {
            matchPostBoundary = 1;
            if (this._fileStream) {
              this._fileStream.push(null);
              this._fileStream = null;
            } else if (field !== void 0) {
              let data2;
              switch (field.length) {
                case 0:
                  data2 = "";
                  break;
                case 1:
                  data2 = convertToUTF8(field[0], partCharset, 0);
                  break;
                default:
                  data2 = convertToUTF8(
                    Buffer.concat(field, fieldSize),
                    partCharset,
                    0
                  );
              }
              field = void 0;
              fieldSize = 0;
              this.emit(
                "field",
                partName,
                data2,
                {
                  nameTruncated: false,
                  valueTruncated: partTruncated,
                  encoding: partEncoding,
                  mimeType: partType
                }
              );
            }
            if (++parts === partsLimit)
              this.emit("partsLimit");
          }
        };
        this._bparser = new StreamSearch(`\r
--${boundary}`, ssCb);
        this._writecb = null;
        this._finalcb = null;
        this.write(BUF_CRLF);
      }
      static detect(conType) {
        return conType.type === "multipart" && conType.subtype === "form-data";
      }
      _write(chunk, enc, cb) {
        this._writecb = cb;
        this._bparser.push(chunk, 0);
        if (this._writecb)
          callAndUnsetCb(this);
      }
      _destroy(err2, cb) {
        this._hparser = null;
        this._bparser = ignoreData;
        if (!err2)
          err2 = checkEndState(this);
        const fileStream = this._fileStream;
        if (fileStream) {
          this._fileStream = null;
          fileStream.destroy(err2);
        }
        cb(err2);
      }
      _final(cb) {
        this._bparser.destroy();
        if (!this._complete)
          return cb(new Error("Unexpected end of form"));
        if (this._fileEndsLeft)
          this._finalcb = finalcb.bind(null, this, cb);
        else
          finalcb(this, cb);
      }
    };
    function finalcb(self, cb, err2) {
      if (err2)
        return cb(err2);
      err2 = checkEndState(self);
      cb(err2);
    }
    function checkEndState(self) {
      if (self._hparser)
        return new Error("Malformed part header");
      const fileStream = self._fileStream;
      if (fileStream) {
        self._fileStream = null;
        fileStream.destroy(new Error("Unexpected end of file"));
      }
      if (!self._complete)
        return new Error("Unexpected end of form");
    }
    var TOKEN = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ];
    var FIELD_VCHAR = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1
    ];
    module.exports = Multipart;
  }
});

// node_modules/busboy/lib/types/urlencoded.js
var require_urlencoded = __commonJS({
  "node_modules/busboy/lib/types/urlencoded.js"(exports2, module) {
    "use strict";
    var { Writable } = __require("stream");
    var { getDecoder } = require_utils();
    var URLEncoded = class extends Writable {
      constructor(cfg) {
        const streamOpts = {
          autoDestroy: true,
          emitClose: true,
          highWaterMark: typeof cfg.highWaterMark === "number" ? cfg.highWaterMark : void 0
        };
        super(streamOpts);
        let charset = cfg.defCharset || "utf8";
        if (cfg.conType.params && typeof cfg.conType.params.charset === "string")
          charset = cfg.conType.params.charset;
        this.charset = charset;
        const limits = cfg.limits;
        this.fieldSizeLimit = limits && typeof limits.fieldSize === "number" ? limits.fieldSize : 1 * 1024 * 1024;
        this.fieldsLimit = limits && typeof limits.fields === "number" ? limits.fields : Infinity;
        this.fieldNameSizeLimit = limits && typeof limits.fieldNameSize === "number" ? limits.fieldNameSize : 100;
        this._inKey = true;
        this._keyTrunc = false;
        this._valTrunc = false;
        this._bytesKey = 0;
        this._bytesVal = 0;
        this._fields = 0;
        this._key = "";
        this._val = "";
        this._byte = -2;
        this._lastPos = 0;
        this._encode = 0;
        this._decoder = getDecoder(charset);
      }
      static detect(conType) {
        return conType.type === "application" && conType.subtype === "x-www-form-urlencoded";
      }
      _write(chunk, enc, cb) {
        if (this._fields >= this.fieldsLimit)
          return cb();
        let i2 = 0;
        const len = chunk.length;
        this._lastPos = 0;
        if (this._byte !== -2) {
          i2 = readPctEnc(this, chunk, i2, len);
          if (i2 === -1)
            return cb(new Error("Malformed urlencoded form"));
          if (i2 >= len)
            return cb();
          if (this._inKey)
            ++this._bytesKey;
          else
            ++this._bytesVal;
        }
        main:
          while (i2 < len) {
            if (this._inKey) {
              i2 = skipKeyBytes(this, chunk, i2, len);
              while (i2 < len) {
                switch (chunk[i2]) {
                  case 61:
                    if (this._lastPos < i2)
                      this._key += chunk.latin1Slice(this._lastPos, i2);
                    this._lastPos = ++i2;
                    this._key = this._decoder(this._key, this._encode);
                    this._encode = 0;
                    this._inKey = false;
                    continue main;
                  case 38:
                    if (this._lastPos < i2)
                      this._key += chunk.latin1Slice(this._lastPos, i2);
                    this._lastPos = ++i2;
                    this._key = this._decoder(this._key, this._encode);
                    this._encode = 0;
                    if (this._bytesKey > 0) {
                      this.emit(
                        "field",
                        this._key,
                        "",
                        {
                          nameTruncated: this._keyTrunc,
                          valueTruncated: false,
                          encoding: this.charset,
                          mimeType: "text/plain"
                        }
                      );
                    }
                    this._key = "";
                    this._val = "";
                    this._keyTrunc = false;
                    this._valTrunc = false;
                    this._bytesKey = 0;
                    this._bytesVal = 0;
                    if (++this._fields >= this.fieldsLimit) {
                      this.emit("fieldsLimit");
                      return cb();
                    }
                    continue;
                  case 43:
                    if (this._lastPos < i2)
                      this._key += chunk.latin1Slice(this._lastPos, i2);
                    this._key += " ";
                    this._lastPos = i2 + 1;
                    break;
                  case 37:
                    if (this._encode === 0)
                      this._encode = 1;
                    if (this._lastPos < i2)
                      this._key += chunk.latin1Slice(this._lastPos, i2);
                    this._lastPos = i2 + 1;
                    this._byte = -1;
                    i2 = readPctEnc(this, chunk, i2 + 1, len);
                    if (i2 === -1)
                      return cb(new Error("Malformed urlencoded form"));
                    if (i2 >= len)
                      return cb();
                    ++this._bytesKey;
                    i2 = skipKeyBytes(this, chunk, i2, len);
                    continue;
                }
                ++i2;
                ++this._bytesKey;
                i2 = skipKeyBytes(this, chunk, i2, len);
              }
              if (this._lastPos < i2)
                this._key += chunk.latin1Slice(this._lastPos, i2);
            } else {
              i2 = skipValBytes(this, chunk, i2, len);
              while (i2 < len) {
                switch (chunk[i2]) {
                  case 38:
                    if (this._lastPos < i2)
                      this._val += chunk.latin1Slice(this._lastPos, i2);
                    this._lastPos = ++i2;
                    this._inKey = true;
                    this._val = this._decoder(this._val, this._encode);
                    this._encode = 0;
                    if (this._bytesKey > 0 || this._bytesVal > 0) {
                      this.emit(
                        "field",
                        this._key,
                        this._val,
                        {
                          nameTruncated: this._keyTrunc,
                          valueTruncated: this._valTrunc,
                          encoding: this.charset,
                          mimeType: "text/plain"
                        }
                      );
                    }
                    this._key = "";
                    this._val = "";
                    this._keyTrunc = false;
                    this._valTrunc = false;
                    this._bytesKey = 0;
                    this._bytesVal = 0;
                    if (++this._fields >= this.fieldsLimit) {
                      this.emit("fieldsLimit");
                      return cb();
                    }
                    continue main;
                  case 43:
                    if (this._lastPos < i2)
                      this._val += chunk.latin1Slice(this._lastPos, i2);
                    this._val += " ";
                    this._lastPos = i2 + 1;
                    break;
                  case 37:
                    if (this._encode === 0)
                      this._encode = 1;
                    if (this._lastPos < i2)
                      this._val += chunk.latin1Slice(this._lastPos, i2);
                    this._lastPos = i2 + 1;
                    this._byte = -1;
                    i2 = readPctEnc(this, chunk, i2 + 1, len);
                    if (i2 === -1)
                      return cb(new Error("Malformed urlencoded form"));
                    if (i2 >= len)
                      return cb();
                    ++this._bytesVal;
                    i2 = skipValBytes(this, chunk, i2, len);
                    continue;
                }
                ++i2;
                ++this._bytesVal;
                i2 = skipValBytes(this, chunk, i2, len);
              }
              if (this._lastPos < i2)
                this._val += chunk.latin1Slice(this._lastPos, i2);
            }
          }
        cb();
      }
      _final(cb) {
        if (this._byte !== -2)
          return cb(new Error("Malformed urlencoded form"));
        if (!this._inKey || this._bytesKey > 0 || this._bytesVal > 0) {
          if (this._inKey)
            this._key = this._decoder(this._key, this._encode);
          else
            this._val = this._decoder(this._val, this._encode);
          this.emit(
            "field",
            this._key,
            this._val,
            {
              nameTruncated: this._keyTrunc,
              valueTruncated: this._valTrunc,
              encoding: this.charset,
              mimeType: "text/plain"
            }
          );
        }
        cb();
      }
    };
    function readPctEnc(self, chunk, pos, len) {
      if (pos >= len)
        return len;
      if (self._byte === -1) {
        const hexUpper = HEX_VALUES[chunk[pos++]];
        if (hexUpper === -1)
          return -1;
        if (hexUpper >= 8)
          self._encode = 2;
        if (pos < len) {
          const hexLower = HEX_VALUES[chunk[pos++]];
          if (hexLower === -1)
            return -1;
          if (self._inKey)
            self._key += String.fromCharCode((hexUpper << 4) + hexLower);
          else
            self._val += String.fromCharCode((hexUpper << 4) + hexLower);
          self._byte = -2;
          self._lastPos = pos;
        } else {
          self._byte = hexUpper;
        }
      } else {
        const hexLower = HEX_VALUES[chunk[pos++]];
        if (hexLower === -1)
          return -1;
        if (self._inKey)
          self._key += String.fromCharCode((self._byte << 4) + hexLower);
        else
          self._val += String.fromCharCode((self._byte << 4) + hexLower);
        self._byte = -2;
        self._lastPos = pos;
      }
      return pos;
    }
    function skipKeyBytes(self, chunk, pos, len) {
      if (self._bytesKey > self.fieldNameSizeLimit) {
        if (!self._keyTrunc) {
          if (self._lastPos < pos)
            self._key += chunk.latin1Slice(self._lastPos, pos - 1);
        }
        self._keyTrunc = true;
        for (; pos < len; ++pos) {
          const code = chunk[pos];
          if (code === 61 || code === 38)
            break;
          ++self._bytesKey;
        }
        self._lastPos = pos;
      }
      return pos;
    }
    function skipValBytes(self, chunk, pos, len) {
      if (self._bytesVal > self.fieldSizeLimit) {
        if (!self._valTrunc) {
          if (self._lastPos < pos)
            self._val += chunk.latin1Slice(self._lastPos, pos - 1);
        }
        self._valTrunc = true;
        for (; pos < len; ++pos) {
          if (chunk[pos] === 38)
            break;
          ++self._bytesVal;
        }
        self._lastPos = pos;
      }
      return pos;
    }
    var HEX_VALUES = [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      10,
      11,
      12,
      13,
      14,
      15,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      10,
      11,
      12,
      13,
      14,
      15,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ];
    module.exports = URLEncoded;
  }
});

// node_modules/busboy/lib/index.js
var require_lib = __commonJS({
  "node_modules/busboy/lib/index.js"(exports2, module) {
    "use strict";
    var { parseContentType } = require_utils();
    function getInstance(cfg) {
      const headers = cfg.headers;
      const conType = parseContentType(headers["content-type"]);
      if (!conType)
        throw new Error("Malformed content type");
      for (const type of TYPES) {
        const matched = type.detect(conType);
        if (!matched)
          continue;
        const instanceCfg = {
          limits: cfg.limits,
          headers,
          conType,
          highWaterMark: void 0,
          fileHwm: void 0,
          defCharset: void 0,
          defParamCharset: void 0,
          preservePath: false
        };
        if (cfg.highWaterMark)
          instanceCfg.highWaterMark = cfg.highWaterMark;
        if (cfg.fileHwm)
          instanceCfg.fileHwm = cfg.fileHwm;
        instanceCfg.defCharset = cfg.defCharset;
        instanceCfg.defParamCharset = cfg.defParamCharset;
        instanceCfg.preservePath = cfg.preservePath;
        return new type(instanceCfg);
      }
      throw new Error(`Unsupported content type: ${headers["content-type"]}`);
    }
    var TYPES = [
      require_multipart(),
      require_urlencoded()
    ].filter(function(typemod) {
      return typeof typemod.detect === "function";
    });
    module.exports = (cfg) => {
      if (typeof cfg !== "object" || cfg === null)
        cfg = {};
      if (typeof cfg.headers !== "object" || cfg.headers === null || typeof cfg.headers["content-type"] !== "string") {
        throw new Error("Missing Content-Type");
      }
      return getInstance(cfg);
    };
  }
});

// server/http/app.mjs
import http from "node:http";
import { readFile as readFile3 } from "node:fs/promises";
import path5 from "node:path";

// server/http/routes.mjs
import path4 from "node:path";

// server/monitor/storage.mjs
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID as randomUUID2 } from "node:crypto";

// server/orders/repository.mjs
import { randomUUID, createHash } from "node:crypto";
var hash = (value) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  return v;
}
var fail = (code, message, status = 400, details = []) => Object.assign(new Error(message), { code, status, details });

// server/monitor/storage.mjs
function createMonitorRepository(directory) {
  const read = async (name) => {
    try {
      return JSON.parse(await readFile(path.join(directory, name), "utf8"));
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw fail("STORAGE_INVALID", "监测视图无法读取，请保留文件并检查备份", 503);
    }
  };
  const viewName = (id) => {
    if (!/^[a-f0-9-]{36}$/.test(id ?? "")) throw fail("VIEW_NOT_FOUND", "视图不存在", 404);
    return "view-" + id + ".json";
  };
  const publish = async (name, value) => {
    await mkdir(directory, { recursive: true });
    const target = path.join(directory, name), tmp = target + "." + randomUUID2() + ".tmp";
    try {
      await writeFile(tmp, JSON.stringify(value), { flag: "wx" });
      await rename(tmp, target);
    } catch (e) {
      await unlink(tmp).catch(() => {
      });
      throw e;
    }
  };
  return {
    async findCached(key) {
      const index = await read("cache-" + key + ".json");
      return index ? (await read(viewName(index.viewId)))?.overview ?? null : null;
    },
    async save(overview, snapshots, key) {
      await publish(viewName(overview.viewId), { overview, snapshots });
      await publish("cache-" + key + ".json", { viewId: overview.viewId });
    },
    async getView(id) {
      return (await read(viewName(id)))?.overview ?? null;
    },
    async getSnapshot(viewId, id) {
      return (await read(viewName(viewId)))?.snapshots.find((s) => s.snapshot_id === id) ?? null;
    }
  };
}

// server/monitor/overview.mjs
import { randomUUID as randomUUID4 } from "node:crypto";

// node_modules/decimal.js/decimal.mjs
/*!
 *  decimal.js v10.6.0
 *  An arbitrary-precision Decimal type for JavaScript.
 *  https://github.com/MikeMcl/decimal.js
 *  Copyright (c) 2025 Michael Mclaughlin <M8ch88l@gmail.com>
 *  MIT Licence
 */
var EXP_LIMIT = 9e15;
var MAX_DIGITS = 1e9;
var NUMERALS = "0123456789abcdef";
var LN10 = "2.3025850929940456840179914546843642076011014886287729760333279009675726096773524802359972050895982983419677840422862486334095254650828067566662873690987816894829072083255546808437998948262331985283935053089653777326288461633662222876982198867465436674744042432743651550489343149393914796194044002221051017141748003688084012647080685567743216228355220114804663715659121373450747856947683463616792101806445070648000277502684916746550586856935673420670581136429224554405758925724208241314695689016758940256776311356919292033376587141660230105703089634572075440370847469940168269282808481184289314848524948644871927809676271275775397027668605952496716674183485704422507197965004714951050492214776567636938662976979522110718264549734772662425709429322582798502585509785265383207606726317164309505995087807523710333101197857547331541421808427543863591778117054309827482385045648019095610299291824318237525357709750539565187697510374970888692180205189339507238539205144634197265287286965110862571492198849978748873771345686209167058";
var PI = "3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094330572703657595919530921861173819326117931051185480744623799627495673518857527248912279381830119491298336733624406566430860213949463952247371907021798609437027705392171762931767523846748184676694051320005681271452635608277857713427577896091736371787214684409012249534301465495853710507922796892589235420199561121290219608640344181598136297747713099605187072113499999983729780499510597317328160963185950244594553469083026425223082533446850352619311881710100031378387528865875332083814206171776691473035982534904287554687311595628638823537875937519577818577805321712268066130019278766111959092164201989380952572010654858632789";
var DEFAULTS = {
  // These values must be integers within the stated ranges (inclusive).
  // Most of these values can be changed at run-time using the `Decimal.config` method.
  // The maximum number of significant digits of the result of a calculation or base conversion.
  // E.g. `Decimal.config({ precision: 20 });`
  precision: 20,
  // 1 to MAX_DIGITS
  // The rounding mode used when rounding to `precision`.
  //
  // ROUND_UP         0 Away from zero.
  // ROUND_DOWN       1 Towards zero.
  // ROUND_CEIL       2 Towards +Infinity.
  // ROUND_FLOOR      3 Towards -Infinity.
  // ROUND_HALF_UP    4 Towards nearest neighbour. If equidistant, up.
  // ROUND_HALF_DOWN  5 Towards nearest neighbour. If equidistant, down.
  // ROUND_HALF_EVEN  6 Towards nearest neighbour. If equidistant, towards even neighbour.
  // ROUND_HALF_CEIL  7 Towards nearest neighbour. If equidistant, towards +Infinity.
  // ROUND_HALF_FLOOR 8 Towards nearest neighbour. If equidistant, towards -Infinity.
  //
  // E.g.
  // `Decimal.rounding = 4;`
  // `Decimal.rounding = Decimal.ROUND_HALF_UP;`
  rounding: 4,
  // 0 to 8
  // The modulo mode used when calculating the modulus: a mod n.
  // The quotient (q = a / n) is calculated according to the corresponding rounding mode.
  // The remainder (r) is calculated as: r = a - n * q.
  //
  // UP         0 The remainder is positive if the dividend is negative, else is negative.
  // DOWN       1 The remainder has the same sign as the dividend (JavaScript %).
  // FLOOR      3 The remainder has the same sign as the divisor (Python %).
  // HALF_EVEN  6 The IEEE 754 remainder function.
  // EUCLID     9 Euclidian division. q = sign(n) * floor(a / abs(n)). Always positive.
  //
  // Truncated division (1), floored division (3), the IEEE 754 remainder (6), and Euclidian
  // division (9) are commonly used for the modulus operation. The other rounding modes can also
  // be used, but they may not give useful results.
  modulo: 1,
  // 0 to 9
  // The exponent value at and beneath which `toString` returns exponential notation.
  // JavaScript numbers: -7
  toExpNeg: -7,
  // 0 to -EXP_LIMIT
  // The exponent value at and above which `toString` returns exponential notation.
  // JavaScript numbers: 21
  toExpPos: 21,
  // 0 to EXP_LIMIT
  // The minimum exponent value, beneath which underflow to zero occurs.
  // JavaScript numbers: -324  (5e-324)
  minE: -EXP_LIMIT,
  // -1 to -EXP_LIMIT
  // The maximum exponent value, above which overflow to Infinity occurs.
  // JavaScript numbers: 308  (1.7976931348623157e+308)
  maxE: EXP_LIMIT,
  // 1 to EXP_LIMIT
  // Whether to use cryptographically-secure random number generation, if available.
  crypto: false
  // true/false
};
var inexact;
var quadrant;
var external = true;
var decimalError = "[DecimalError] ";
var invalidArgument = decimalError + "Invalid argument: ";
var precisionLimitExceeded = decimalError + "Precision limit exceeded";
var cryptoUnavailable = decimalError + "crypto unavailable";
var tag = "[object Decimal]";
var mathfloor = Math.floor;
var mathpow = Math.pow;
var isBinary = /^0b([01]+(\.[01]*)?|\.[01]+)(p[+-]?\d+)?$/i;
var isHex = /^0x([0-9a-f]+(\.[0-9a-f]*)?|\.[0-9a-f]+)(p[+-]?\d+)?$/i;
var isOctal = /^0o([0-7]+(\.[0-7]*)?|\.[0-7]+)(p[+-]?\d+)?$/i;
var isDecimal = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
var BASE = 1e7;
var LOG_BASE = 7;
var MAX_SAFE_INTEGER = 9007199254740991;
var LN10_PRECISION = LN10.length - 1;
var PI_PRECISION = PI.length - 1;
var P = { toStringTag: tag };
P.absoluteValue = P.abs = function() {
  var x2 = new this.constructor(this);
  if (x2.s < 0) x2.s = 1;
  return finalise(x2);
};
P.ceil = function() {
  return finalise(new this.constructor(this), this.e + 1, 2);
};
P.clampedTo = P.clamp = function(min2, max3) {
  var k, x2 = this, Ctor = x2.constructor;
  min2 = new Ctor(min2);
  max3 = new Ctor(max3);
  if (!min2.s || !max3.s) return new Ctor(NaN);
  if (min2.gt(max3)) throw Error(invalidArgument + max3);
  k = x2.cmp(min2);
  return k < 0 ? min2 : x2.cmp(max3) > 0 ? max3 : new Ctor(x2);
};
P.comparedTo = P.cmp = function(y) {
  var i2, j, xdL, ydL, x2 = this, xd = x2.d, yd = (y = new x2.constructor(y)).d, xs = x2.s, ys = y.s;
  if (!xd || !yd) {
    return !xs || !ys ? NaN : xs !== ys ? xs : xd === yd ? 0 : !xd ^ xs < 0 ? 1 : -1;
  }
  if (!xd[0] || !yd[0]) return xd[0] ? xs : yd[0] ? -ys : 0;
  if (xs !== ys) return xs;
  if (x2.e !== y.e) return x2.e > y.e ^ xs < 0 ? 1 : -1;
  xdL = xd.length;
  ydL = yd.length;
  for (i2 = 0, j = xdL < ydL ? xdL : ydL; i2 < j; ++i2) {
    if (xd[i2] !== yd[i2]) return xd[i2] > yd[i2] ^ xs < 0 ? 1 : -1;
  }
  return xdL === ydL ? 0 : xdL > ydL ^ xs < 0 ? 1 : -1;
};
P.cosine = P.cos = function() {
  var pr, rm, x2 = this, Ctor = x2.constructor;
  if (!x2.d) return new Ctor(NaN);
  if (!x2.d[0]) return new Ctor(1);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x2.e, x2.sd()) + LOG_BASE;
  Ctor.rounding = 1;
  x2 = cosine(Ctor, toLessThanHalfPi(Ctor, x2));
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant == 2 || quadrant == 3 ? x2.neg() : x2, pr, rm, true);
};
P.cubeRoot = P.cbrt = function() {
  var e, m, n, r, rep, s, sd, t, t3, t3plusx, x2 = this, Ctor = x2.constructor;
  if (!x2.isFinite() || x2.isZero()) return new Ctor(x2);
  external = false;
  s = x2.s * mathpow(x2.s * x2, 1 / 3);
  if (!s || Math.abs(s) == 1 / 0) {
    n = digitsToString(x2.d);
    e = x2.e;
    if (s = (e - n.length + 1) % 3) n += s == 1 || s == -2 ? "0" : "00";
    s = mathpow(n, 1 / 3);
    e = mathfloor((e + 1) / 3) - (e % 3 == (e < 0 ? -1 : 2));
    if (s == 1 / 0) {
      n = "5e" + e;
    } else {
      n = s.toExponential();
      n = n.slice(0, n.indexOf("e") + 1) + e;
    }
    r = new Ctor(n);
    r.s = x2.s;
  } else {
    r = new Ctor(s.toString());
  }
  sd = (e = Ctor.precision) + 3;
  for (; ; ) {
    t = r;
    t3 = t.times(t).times(t);
    t3plusx = t3.plus(x2);
    r = divide(t3plusx.plus(x2).times(t), t3plusx.plus(t3), sd + 2, 1);
    if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
      n = n.slice(sd - 3, sd + 1);
      if (n == "9999" || !rep && n == "4999") {
        if (!rep) {
          finalise(t, e + 1, 0);
          if (t.times(t).times(t).eq(x2)) {
            r = t;
            break;
          }
        }
        sd += 4;
        rep = 1;
      } else {
        if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
          finalise(r, e + 1, 1);
          m = !r.times(r).times(r).eq(x2);
        }
        break;
      }
    }
  }
  external = true;
  return finalise(r, e, Ctor.rounding, m);
};
P.decimalPlaces = P.dp = function() {
  var w, d = this.d, n = NaN;
  if (d) {
    w = d.length - 1;
    n = (w - mathfloor(this.e / LOG_BASE)) * LOG_BASE;
    w = d[w];
    if (w) for (; w % 10 == 0; w /= 10) n--;
    if (n < 0) n = 0;
  }
  return n;
};
P.dividedBy = P.div = function(y) {
  return divide(this, new this.constructor(y));
};
P.dividedToIntegerBy = P.divToInt = function(y) {
  var x2 = this, Ctor = x2.constructor;
  return finalise(divide(x2, new Ctor(y), 0, 1, 1), Ctor.precision, Ctor.rounding);
};
P.equals = P.eq = function(y) {
  return this.cmp(y) === 0;
};
P.floor = function() {
  return finalise(new this.constructor(this), this.e + 1, 3);
};
P.greaterThan = P.gt = function(y) {
  return this.cmp(y) > 0;
};
P.greaterThanOrEqualTo = P.gte = function(y) {
  var k = this.cmp(y);
  return k == 1 || k === 0;
};
P.hyperbolicCosine = P.cosh = function() {
  var k, n, pr, rm, len, x2 = this, Ctor = x2.constructor, one = new Ctor(1);
  if (!x2.isFinite()) return new Ctor(x2.s ? 1 / 0 : NaN);
  if (x2.isZero()) return one;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x2.e, x2.sd()) + 4;
  Ctor.rounding = 1;
  len = x2.d.length;
  if (len < 32) {
    k = Math.ceil(len / 3);
    n = (1 / tinyPow(4, k)).toString();
  } else {
    k = 16;
    n = "2.3283064365386962890625e-10";
  }
  x2 = taylorSeries(Ctor, 1, x2.times(n), new Ctor(1), true);
  var cosh2_x, i2 = k, d8 = new Ctor(8);
  for (; i2--; ) {
    cosh2_x = x2.times(x2);
    x2 = one.minus(cosh2_x.times(d8.minus(cosh2_x.times(d8))));
  }
  return finalise(x2, Ctor.precision = pr, Ctor.rounding = rm, true);
};
P.hyperbolicSine = P.sinh = function() {
  var k, pr, rm, len, x2 = this, Ctor = x2.constructor;
  if (!x2.isFinite() || x2.isZero()) return new Ctor(x2);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x2.e, x2.sd()) + 4;
  Ctor.rounding = 1;
  len = x2.d.length;
  if (len < 3) {
    x2 = taylorSeries(Ctor, 2, x2, x2, true);
  } else {
    k = 1.4 * Math.sqrt(len);
    k = k > 16 ? 16 : k | 0;
    x2 = x2.times(1 / tinyPow(5, k));
    x2 = taylorSeries(Ctor, 2, x2, x2, true);
    var sinh2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
    for (; k--; ) {
      sinh2_x = x2.times(x2);
      x2 = x2.times(d5.plus(sinh2_x.times(d16.times(sinh2_x).plus(d20))));
    }
  }
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(x2, pr, rm, true);
};
P.hyperbolicTangent = P.tanh = function() {
  var pr, rm, x2 = this, Ctor = x2.constructor;
  if (!x2.isFinite()) return new Ctor(x2.s);
  if (x2.isZero()) return new Ctor(x2);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 7;
  Ctor.rounding = 1;
  return divide(x2.sinh(), x2.cosh(), Ctor.precision = pr, Ctor.rounding = rm);
};
P.inverseCosine = P.acos = function() {
  var x2 = this, Ctor = x2.constructor, k = x2.abs().cmp(1), pr = Ctor.precision, rm = Ctor.rounding;
  if (k !== -1) {
    return k === 0 ? x2.isNeg() ? getPi(Ctor, pr, rm) : new Ctor(0) : new Ctor(NaN);
  }
  if (x2.isZero()) return getPi(Ctor, pr + 4, rm).times(0.5);
  Ctor.precision = pr + 6;
  Ctor.rounding = 1;
  x2 = new Ctor(1).minus(x2).div(x2.plus(1)).sqrt().atan();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x2.times(2);
};
P.inverseHyperbolicCosine = P.acosh = function() {
  var pr, rm, x2 = this, Ctor = x2.constructor;
  if (x2.lte(1)) return new Ctor(x2.eq(1) ? 0 : NaN);
  if (!x2.isFinite()) return new Ctor(x2);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(Math.abs(x2.e), x2.sd()) + 4;
  Ctor.rounding = 1;
  external = false;
  x2 = x2.times(x2).minus(1).sqrt().plus(x2);
  external = true;
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x2.ln();
};
P.inverseHyperbolicSine = P.asinh = function() {
  var pr, rm, x2 = this, Ctor = x2.constructor;
  if (!x2.isFinite() || x2.isZero()) return new Ctor(x2);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 2 * Math.max(Math.abs(x2.e), x2.sd()) + 6;
  Ctor.rounding = 1;
  external = false;
  x2 = x2.times(x2).plus(1).sqrt().plus(x2);
  external = true;
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x2.ln();
};
P.inverseHyperbolicTangent = P.atanh = function() {
  var pr, rm, wpr, xsd, x2 = this, Ctor = x2.constructor;
  if (!x2.isFinite()) return new Ctor(NaN);
  if (x2.e >= 0) return new Ctor(x2.abs().eq(1) ? x2.s / 0 : x2.isZero() ? x2 : NaN);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  xsd = x2.sd();
  if (Math.max(xsd, pr) < 2 * -x2.e - 1) return finalise(new Ctor(x2), pr, rm, true);
  Ctor.precision = wpr = xsd - x2.e;
  x2 = divide(x2.plus(1), new Ctor(1).minus(x2), wpr + pr, 1);
  Ctor.precision = pr + 4;
  Ctor.rounding = 1;
  x2 = x2.ln();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x2.times(0.5);
};
P.inverseSine = P.asin = function() {
  var halfPi, k, pr, rm, x2 = this, Ctor = x2.constructor;
  if (x2.isZero()) return new Ctor(x2);
  k = x2.abs().cmp(1);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (k !== -1) {
    if (k === 0) {
      halfPi = getPi(Ctor, pr + 4, rm).times(0.5);
      halfPi.s = x2.s;
      return halfPi;
    }
    return new Ctor(NaN);
  }
  Ctor.precision = pr + 6;
  Ctor.rounding = 1;
  x2 = x2.div(new Ctor(1).minus(x2.times(x2)).sqrt().plus(1)).atan();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x2.times(2);
};
P.inverseTangent = P.atan = function() {
  var i2, j, k, n, px, t, r, wpr, x2, x3 = this, Ctor = x3.constructor, pr = Ctor.precision, rm = Ctor.rounding;
  if (!x3.isFinite()) {
    if (!x3.s) return new Ctor(NaN);
    if (pr + 4 <= PI_PRECISION) {
      r = getPi(Ctor, pr + 4, rm).times(0.5);
      r.s = x3.s;
      return r;
    }
  } else if (x3.isZero()) {
    return new Ctor(x3);
  } else if (x3.abs().eq(1) && pr + 4 <= PI_PRECISION) {
    r = getPi(Ctor, pr + 4, rm).times(0.25);
    r.s = x3.s;
    return r;
  }
  Ctor.precision = wpr = pr + 10;
  Ctor.rounding = 1;
  k = Math.min(28, wpr / LOG_BASE + 2 | 0);
  for (i2 = k; i2; --i2) x3 = x3.div(x3.times(x3).plus(1).sqrt().plus(1));
  external = false;
  j = Math.ceil(wpr / LOG_BASE);
  n = 1;
  x2 = x3.times(x3);
  r = new Ctor(x3);
  px = x3;
  for (; i2 !== -1; ) {
    px = px.times(x2);
    t = r.minus(px.div(n += 2));
    px = px.times(x2);
    r = t.plus(px.div(n += 2));
    if (r.d[j] !== void 0) for (i2 = j; r.d[i2] === t.d[i2] && i2--; ) ;
  }
  if (k) r = r.times(2 << k - 1);
  external = true;
  return finalise(r, Ctor.precision = pr, Ctor.rounding = rm, true);
};
P.isFinite = function() {
  return !!this.d;
};
P.isInteger = P.isInt = function() {
  return !!this.d && mathfloor(this.e / LOG_BASE) > this.d.length - 2;
};
P.isNaN = function() {
  return !this.s;
};
P.isNegative = P.isNeg = function() {
  return this.s < 0;
};
P.isPositive = P.isPos = function() {
  return this.s > 0;
};
P.isZero = function() {
  return !!this.d && this.d[0] === 0;
};
P.lessThan = P.lt = function(y) {
  return this.cmp(y) < 0;
};
P.lessThanOrEqualTo = P.lte = function(y) {
  return this.cmp(y) < 1;
};
P.logarithm = P.log = function(base) {
  var isBase10, d, denominator, k, inf, num, sd, r, arg = this, Ctor = arg.constructor, pr = Ctor.precision, rm = Ctor.rounding, guard = 5;
  if (base == null) {
    base = new Ctor(10);
    isBase10 = true;
  } else {
    base = new Ctor(base);
    d = base.d;
    if (base.s < 0 || !d || !d[0] || base.eq(1)) return new Ctor(NaN);
    isBase10 = base.eq(10);
  }
  d = arg.d;
  if (arg.s < 0 || !d || !d[0] || arg.eq(1)) {
    return new Ctor(d && !d[0] ? -1 / 0 : arg.s != 1 ? NaN : d ? 0 : 1 / 0);
  }
  if (isBase10) {
    if (d.length > 1) {
      inf = true;
    } else {
      for (k = d[0]; k % 10 === 0; ) k /= 10;
      inf = k !== 1;
    }
  }
  external = false;
  sd = pr + guard;
  num = naturalLogarithm(arg, sd);
  denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
  r = divide(num, denominator, sd, 1);
  if (checkRoundingDigits(r.d, k = pr, rm)) {
    do {
      sd += 10;
      num = naturalLogarithm(arg, sd);
      denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
      r = divide(num, denominator, sd, 1);
      if (!inf) {
        if (+digitsToString(r.d).slice(k + 1, k + 15) + 1 == 1e14) {
          r = finalise(r, pr + 1, 0);
        }
        break;
      }
    } while (checkRoundingDigits(r.d, k += 10, rm));
  }
  external = true;
  return finalise(r, pr, rm);
};
P.minus = P.sub = function(y) {
  var d, e, i2, j, k, len, pr, rm, xd, xe, xLTy, yd, x2 = this, Ctor = x2.constructor;
  y = new Ctor(y);
  if (!x2.d || !y.d) {
    if (!x2.s || !y.s) y = new Ctor(NaN);
    else if (x2.d) y.s = -y.s;
    else y = new Ctor(y.d || x2.s !== y.s ? x2 : NaN);
    return y;
  }
  if (x2.s != y.s) {
    y.s = -y.s;
    return x2.plus(y);
  }
  xd = x2.d;
  yd = y.d;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (!xd[0] || !yd[0]) {
    if (yd[0]) y.s = -y.s;
    else if (xd[0]) y = new Ctor(x2);
    else return new Ctor(rm === 3 ? -0 : 0);
    return external ? finalise(y, pr, rm) : y;
  }
  e = mathfloor(y.e / LOG_BASE);
  xe = mathfloor(x2.e / LOG_BASE);
  xd = xd.slice();
  k = xe - e;
  if (k) {
    xLTy = k < 0;
    if (xLTy) {
      d = xd;
      k = -k;
      len = yd.length;
    } else {
      d = yd;
      e = xe;
      len = xd.length;
    }
    i2 = Math.max(Math.ceil(pr / LOG_BASE), len) + 2;
    if (k > i2) {
      k = i2;
      d.length = 1;
    }
    d.reverse();
    for (i2 = k; i2--; ) d.push(0);
    d.reverse();
  } else {
    i2 = xd.length;
    len = yd.length;
    xLTy = i2 < len;
    if (xLTy) len = i2;
    for (i2 = 0; i2 < len; i2++) {
      if (xd[i2] != yd[i2]) {
        xLTy = xd[i2] < yd[i2];
        break;
      }
    }
    k = 0;
  }
  if (xLTy) {
    d = xd;
    xd = yd;
    yd = d;
    y.s = -y.s;
  }
  len = xd.length;
  for (i2 = yd.length - len; i2 > 0; --i2) xd[len++] = 0;
  for (i2 = yd.length; i2 > k; ) {
    if (xd[--i2] < yd[i2]) {
      for (j = i2; j && xd[--j] === 0; ) xd[j] = BASE - 1;
      --xd[j];
      xd[i2] += BASE;
    }
    xd[i2] -= yd[i2];
  }
  for (; xd[--len] === 0; ) xd.pop();
  for (; xd[0] === 0; xd.shift()) --e;
  if (!xd[0]) return new Ctor(rm === 3 ? -0 : 0);
  y.d = xd;
  y.e = getBase10Exponent(xd, e);
  return external ? finalise(y, pr, rm) : y;
};
P.modulo = P.mod = function(y) {
  var q, x2 = this, Ctor = x2.constructor;
  y = new Ctor(y);
  if (!x2.d || !y.s || y.d && !y.d[0]) return new Ctor(NaN);
  if (!y.d || x2.d && !x2.d[0]) {
    return finalise(new Ctor(x2), Ctor.precision, Ctor.rounding);
  }
  external = false;
  if (Ctor.modulo == 9) {
    q = divide(x2, y.abs(), 0, 3, 1);
    q.s *= y.s;
  } else {
    q = divide(x2, y, 0, Ctor.modulo, 1);
  }
  q = q.times(y);
  external = true;
  return x2.minus(q);
};
P.naturalExponential = P.exp = function() {
  return naturalExponential(this);
};
P.naturalLogarithm = P.ln = function() {
  return naturalLogarithm(this);
};
P.negated = P.neg = function() {
  var x2 = new this.constructor(this);
  x2.s = -x2.s;
  return finalise(x2);
};
P.plus = P.add = function(y) {
  var carry, d, e, i2, k, len, pr, rm, xd, yd, x2 = this, Ctor = x2.constructor;
  y = new Ctor(y);
  if (!x2.d || !y.d) {
    if (!x2.s || !y.s) y = new Ctor(NaN);
    else if (!x2.d) y = new Ctor(y.d || x2.s === y.s ? x2 : NaN);
    return y;
  }
  if (x2.s != y.s) {
    y.s = -y.s;
    return x2.minus(y);
  }
  xd = x2.d;
  yd = y.d;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (!xd[0] || !yd[0]) {
    if (!yd[0]) y = new Ctor(x2);
    return external ? finalise(y, pr, rm) : y;
  }
  k = mathfloor(x2.e / LOG_BASE);
  e = mathfloor(y.e / LOG_BASE);
  xd = xd.slice();
  i2 = k - e;
  if (i2) {
    if (i2 < 0) {
      d = xd;
      i2 = -i2;
      len = yd.length;
    } else {
      d = yd;
      e = k;
      len = xd.length;
    }
    k = Math.ceil(pr / LOG_BASE);
    len = k > len ? k + 1 : len + 1;
    if (i2 > len) {
      i2 = len;
      d.length = 1;
    }
    d.reverse();
    for (; i2--; ) d.push(0);
    d.reverse();
  }
  len = xd.length;
  i2 = yd.length;
  if (len - i2 < 0) {
    i2 = len;
    d = yd;
    yd = xd;
    xd = d;
  }
  for (carry = 0; i2; ) {
    carry = (xd[--i2] = xd[i2] + yd[i2] + carry) / BASE | 0;
    xd[i2] %= BASE;
  }
  if (carry) {
    xd.unshift(carry);
    ++e;
  }
  for (len = xd.length; xd[--len] == 0; ) xd.pop();
  y.d = xd;
  y.e = getBase10Exponent(xd, e);
  return external ? finalise(y, pr, rm) : y;
};
P.precision = P.sd = function(z) {
  var k, x2 = this;
  if (z !== void 0 && z !== !!z && z !== 1 && z !== 0) throw Error(invalidArgument + z);
  if (x2.d) {
    k = getPrecision(x2.d);
    if (z && x2.e + 1 > k) k = x2.e + 1;
  } else {
    k = NaN;
  }
  return k;
};
P.round = function() {
  var x2 = this, Ctor = x2.constructor;
  return finalise(new Ctor(x2), x2.e + 1, Ctor.rounding);
};
P.sine = P.sin = function() {
  var pr, rm, x2 = this, Ctor = x2.constructor;
  if (!x2.isFinite()) return new Ctor(NaN);
  if (x2.isZero()) return new Ctor(x2);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x2.e, x2.sd()) + LOG_BASE;
  Ctor.rounding = 1;
  x2 = sine(Ctor, toLessThanHalfPi(Ctor, x2));
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant > 2 ? x2.neg() : x2, pr, rm, true);
};
P.squareRoot = P.sqrt = function() {
  var m, n, sd, r, rep, t, x2 = this, d = x2.d, e = x2.e, s = x2.s, Ctor = x2.constructor;
  if (s !== 1 || !d || !d[0]) {
    return new Ctor(!s || s < 0 && (!d || d[0]) ? NaN : d ? x2 : 1 / 0);
  }
  external = false;
  s = Math.sqrt(+x2);
  if (s == 0 || s == 1 / 0) {
    n = digitsToString(d);
    if ((n.length + e) % 2 == 0) n += "0";
    s = Math.sqrt(n);
    e = mathfloor((e + 1) / 2) - (e < 0 || e % 2);
    if (s == 1 / 0) {
      n = "5e" + e;
    } else {
      n = s.toExponential();
      n = n.slice(0, n.indexOf("e") + 1) + e;
    }
    r = new Ctor(n);
  } else {
    r = new Ctor(s.toString());
  }
  sd = (e = Ctor.precision) + 3;
  for (; ; ) {
    t = r;
    r = t.plus(divide(x2, t, sd + 2, 1)).times(0.5);
    if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
      n = n.slice(sd - 3, sd + 1);
      if (n == "9999" || !rep && n == "4999") {
        if (!rep) {
          finalise(t, e + 1, 0);
          if (t.times(t).eq(x2)) {
            r = t;
            break;
          }
        }
        sd += 4;
        rep = 1;
      } else {
        if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
          finalise(r, e + 1, 1);
          m = !r.times(r).eq(x2);
        }
        break;
      }
    }
  }
  external = true;
  return finalise(r, e, Ctor.rounding, m);
};
P.tangent = P.tan = function() {
  var pr, rm, x2 = this, Ctor = x2.constructor;
  if (!x2.isFinite()) return new Ctor(NaN);
  if (x2.isZero()) return new Ctor(x2);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 10;
  Ctor.rounding = 1;
  x2 = x2.sin();
  x2.s = 1;
  x2 = divide(x2, new Ctor(1).minus(x2.times(x2)).sqrt(), pr + 10, 0);
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant == 2 || quadrant == 4 ? x2.neg() : x2, pr, rm, true);
};
P.times = P.mul = function(y) {
  var carry, e, i2, k, r, rL, t, xdL, ydL, x2 = this, Ctor = x2.constructor, xd = x2.d, yd = (y = new Ctor(y)).d;
  y.s *= x2.s;
  if (!xd || !xd[0] || !yd || !yd[0]) {
    return new Ctor(!y.s || xd && !xd[0] && !yd || yd && !yd[0] && !xd ? NaN : !xd || !yd ? y.s / 0 : y.s * 0);
  }
  e = mathfloor(x2.e / LOG_BASE) + mathfloor(y.e / LOG_BASE);
  xdL = xd.length;
  ydL = yd.length;
  if (xdL < ydL) {
    r = xd;
    xd = yd;
    yd = r;
    rL = xdL;
    xdL = ydL;
    ydL = rL;
  }
  r = [];
  rL = xdL + ydL;
  for (i2 = rL; i2--; ) r.push(0);
  for (i2 = ydL; --i2 >= 0; ) {
    carry = 0;
    for (k = xdL + i2; k > i2; ) {
      t = r[k] + yd[i2] * xd[k - i2 - 1] + carry;
      r[k--] = t % BASE | 0;
      carry = t / BASE | 0;
    }
    r[k] = (r[k] + carry) % BASE | 0;
  }
  for (; !r[--rL]; ) r.pop();
  if (carry) ++e;
  else r.shift();
  y.d = r;
  y.e = getBase10Exponent(r, e);
  return external ? finalise(y, Ctor.precision, Ctor.rounding) : y;
};
P.toBinary = function(sd, rm) {
  return toStringBinary(this, 2, sd, rm);
};
P.toDecimalPlaces = P.toDP = function(dp, rm) {
  var x2 = this, Ctor = x2.constructor;
  x2 = new Ctor(x2);
  if (dp === void 0) return x2;
  checkInt32(dp, 0, MAX_DIGITS);
  if (rm === void 0) rm = Ctor.rounding;
  else checkInt32(rm, 0, 8);
  return finalise(x2, dp + x2.e + 1, rm);
};
P.toExponential = function(dp, rm) {
  var str, x2 = this, Ctor = x2.constructor;
  if (dp === void 0) {
    str = finiteToString(x2, true);
  } else {
    checkInt32(dp, 0, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    x2 = finalise(new Ctor(x2), dp + 1, rm);
    str = finiteToString(x2, true, dp + 1);
  }
  return x2.isNeg() && !x2.isZero() ? "-" + str : str;
};
P.toFixed = function(dp, rm) {
  var str, y, x2 = this, Ctor = x2.constructor;
  if (dp === void 0) {
    str = finiteToString(x2);
  } else {
    checkInt32(dp, 0, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    y = finalise(new Ctor(x2), dp + x2.e + 1, rm);
    str = finiteToString(y, false, dp + y.e + 1);
  }
  return x2.isNeg() && !x2.isZero() ? "-" + str : str;
};
P.toFraction = function(maxD) {
  var d, d0, d1, d2, e, k, n, n0, n1, pr, q, r, x2 = this, xd = x2.d, Ctor = x2.constructor;
  if (!xd) return new Ctor(x2);
  n1 = d0 = new Ctor(1);
  d1 = n0 = new Ctor(0);
  d = new Ctor(d1);
  e = d.e = getPrecision(xd) - x2.e - 1;
  k = e % LOG_BASE;
  d.d[0] = mathpow(10, k < 0 ? LOG_BASE + k : k);
  if (maxD == null) {
    maxD = e > 0 ? d : n1;
  } else {
    n = new Ctor(maxD);
    if (!n.isInt() || n.lt(n1)) throw Error(invalidArgument + n);
    maxD = n.gt(d) ? e > 0 ? d : n1 : n;
  }
  external = false;
  n = new Ctor(digitsToString(xd));
  pr = Ctor.precision;
  Ctor.precision = e = xd.length * LOG_BASE * 2;
  for (; ; ) {
    q = divide(n, d, 0, 1, 1);
    d2 = d0.plus(q.times(d1));
    if (d2.cmp(maxD) == 1) break;
    d0 = d1;
    d1 = d2;
    d2 = n1;
    n1 = n0.plus(q.times(d2));
    n0 = d2;
    d2 = d;
    d = n.minus(q.times(d2));
    n = d2;
  }
  d2 = divide(maxD.minus(d0), d1, 0, 1, 1);
  n0 = n0.plus(d2.times(n1));
  d0 = d0.plus(d2.times(d1));
  n0.s = n1.s = x2.s;
  r = divide(n1, d1, e, 1).minus(x2).abs().cmp(divide(n0, d0, e, 1).minus(x2).abs()) < 1 ? [n1, d1] : [n0, d0];
  Ctor.precision = pr;
  external = true;
  return r;
};
P.toHexadecimal = P.toHex = function(sd, rm) {
  return toStringBinary(this, 16, sd, rm);
};
P.toNearest = function(y, rm) {
  var x2 = this, Ctor = x2.constructor;
  x2 = new Ctor(x2);
  if (y == null) {
    if (!x2.d) return x2;
    y = new Ctor(1);
    rm = Ctor.rounding;
  } else {
    y = new Ctor(y);
    if (rm === void 0) {
      rm = Ctor.rounding;
    } else {
      checkInt32(rm, 0, 8);
    }
    if (!x2.d) return y.s ? x2 : y;
    if (!y.d) {
      if (y.s) y.s = x2.s;
      return y;
    }
  }
  if (y.d[0]) {
    external = false;
    x2 = divide(x2, y, 0, rm, 1).times(y);
    external = true;
    finalise(x2);
  } else {
    y.s = x2.s;
    x2 = y;
  }
  return x2;
};
P.toNumber = function() {
  return +this;
};
P.toOctal = function(sd, rm) {
  return toStringBinary(this, 8, sd, rm);
};
P.toPower = P.pow = function(y) {
  var e, k, pr, r, rm, s, x2 = this, Ctor = x2.constructor, yn = +(y = new Ctor(y));
  if (!x2.d || !y.d || !x2.d[0] || !y.d[0]) return new Ctor(mathpow(+x2, yn));
  x2 = new Ctor(x2);
  if (x2.eq(1)) return x2;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (y.eq(1)) return finalise(x2, pr, rm);
  e = mathfloor(y.e / LOG_BASE);
  if (e >= y.d.length - 1 && (k = yn < 0 ? -yn : yn) <= MAX_SAFE_INTEGER) {
    r = intPow(Ctor, x2, k, pr);
    return y.s < 0 ? new Ctor(1).div(r) : finalise(r, pr, rm);
  }
  s = x2.s;
  if (s < 0) {
    if (e < y.d.length - 1) return new Ctor(NaN);
    if ((y.d[e] & 1) == 0) s = 1;
    if (x2.e == 0 && x2.d[0] == 1 && x2.d.length == 1) {
      x2.s = s;
      return x2;
    }
  }
  k = mathpow(+x2, yn);
  e = k == 0 || !isFinite(k) ? mathfloor(yn * (Math.log("0." + digitsToString(x2.d)) / Math.LN10 + x2.e + 1)) : new Ctor(k + "").e;
  if (e > Ctor.maxE + 1 || e < Ctor.minE - 1) return new Ctor(e > 0 ? s / 0 : 0);
  external = false;
  Ctor.rounding = x2.s = 1;
  k = Math.min(12, (e + "").length);
  r = naturalExponential(y.times(naturalLogarithm(x2, pr + k)), pr);
  if (r.d) {
    r = finalise(r, pr + 5, 1);
    if (checkRoundingDigits(r.d, pr, rm)) {
      e = pr + 10;
      r = finalise(naturalExponential(y.times(naturalLogarithm(x2, e + k)), e), e + 5, 1);
      if (+digitsToString(r.d).slice(pr + 1, pr + 15) + 1 == 1e14) {
        r = finalise(r, pr + 1, 0);
      }
    }
  }
  r.s = s;
  external = true;
  Ctor.rounding = rm;
  return finalise(r, pr, rm);
};
P.toPrecision = function(sd, rm) {
  var str, x2 = this, Ctor = x2.constructor;
  if (sd === void 0) {
    str = finiteToString(x2, x2.e <= Ctor.toExpNeg || x2.e >= Ctor.toExpPos);
  } else {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    x2 = finalise(new Ctor(x2), sd, rm);
    str = finiteToString(x2, sd <= x2.e || x2.e <= Ctor.toExpNeg, sd);
  }
  return x2.isNeg() && !x2.isZero() ? "-" + str : str;
};
P.toSignificantDigits = P.toSD = function(sd, rm) {
  var x2 = this, Ctor = x2.constructor;
  if (sd === void 0) {
    sd = Ctor.precision;
    rm = Ctor.rounding;
  } else {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
  }
  return finalise(new Ctor(x2), sd, rm);
};
P.toString = function() {
  var x2 = this, Ctor = x2.constructor, str = finiteToString(x2, x2.e <= Ctor.toExpNeg || x2.e >= Ctor.toExpPos);
  return x2.isNeg() && !x2.isZero() ? "-" + str : str;
};
P.truncated = P.trunc = function() {
  return finalise(new this.constructor(this), this.e + 1, 1);
};
P.valueOf = P.toJSON = function() {
  var x2 = this, Ctor = x2.constructor, str = finiteToString(x2, x2.e <= Ctor.toExpNeg || x2.e >= Ctor.toExpPos);
  return x2.isNeg() ? "-" + str : str;
};
function digitsToString(d) {
  var i2, k, ws, indexOfLastWord = d.length - 1, str = "", w = d[0];
  if (indexOfLastWord > 0) {
    str += w;
    for (i2 = 1; i2 < indexOfLastWord; i2++) {
      ws = d[i2] + "";
      k = LOG_BASE - ws.length;
      if (k) str += getZeroString(k);
      str += ws;
    }
    w = d[i2];
    ws = w + "";
    k = LOG_BASE - ws.length;
    if (k) str += getZeroString(k);
  } else if (w === 0) {
    return "0";
  }
  for (; w % 10 === 0; ) w /= 10;
  return str + w;
}
function checkInt32(i2, min2, max3) {
  if (i2 !== ~~i2 || i2 < min2 || i2 > max3) {
    throw Error(invalidArgument + i2);
  }
}
function checkRoundingDigits(d, i2, rm, repeating) {
  var di, k, r, rd;
  for (k = d[0]; k >= 10; k /= 10) --i2;
  if (--i2 < 0) {
    i2 += LOG_BASE;
    di = 0;
  } else {
    di = Math.ceil((i2 + 1) / LOG_BASE);
    i2 %= LOG_BASE;
  }
  k = mathpow(10, LOG_BASE - i2);
  rd = d[di] % k | 0;
  if (repeating == null) {
    if (i2 < 3) {
      if (i2 == 0) rd = rd / 100 | 0;
      else if (i2 == 1) rd = rd / 10 | 0;
      r = rm < 4 && rd == 99999 || rm > 3 && rd == 49999 || rd == 5e4 || rd == 0;
    } else {
      r = (rm < 4 && rd + 1 == k || rm > 3 && rd + 1 == k / 2) && (d[di + 1] / k / 100 | 0) == mathpow(10, i2 - 2) - 1 || (rd == k / 2 || rd == 0) && (d[di + 1] / k / 100 | 0) == 0;
    }
  } else {
    if (i2 < 4) {
      if (i2 == 0) rd = rd / 1e3 | 0;
      else if (i2 == 1) rd = rd / 100 | 0;
      else if (i2 == 2) rd = rd / 10 | 0;
      r = (repeating || rm < 4) && rd == 9999 || !repeating && rm > 3 && rd == 4999;
    } else {
      r = ((repeating || rm < 4) && rd + 1 == k || !repeating && rm > 3 && rd + 1 == k / 2) && (d[di + 1] / k / 1e3 | 0) == mathpow(10, i2 - 3) - 1;
    }
  }
  return r;
}
function convertBase(str, baseIn, baseOut) {
  var j, arr2 = [0], arrL, i2 = 0, strL = str.length;
  for (; i2 < strL; ) {
    for (arrL = arr2.length; arrL--; ) arr2[arrL] *= baseIn;
    arr2[0] += NUMERALS.indexOf(str.charAt(i2++));
    for (j = 0; j < arr2.length; j++) {
      if (arr2[j] > baseOut - 1) {
        if (arr2[j + 1] === void 0) arr2[j + 1] = 0;
        arr2[j + 1] += arr2[j] / baseOut | 0;
        arr2[j] %= baseOut;
      }
    }
  }
  return arr2.reverse();
}
function cosine(Ctor, x2) {
  var k, len, y;
  if (x2.isZero()) return x2;
  len = x2.d.length;
  if (len < 32) {
    k = Math.ceil(len / 3);
    y = (1 / tinyPow(4, k)).toString();
  } else {
    k = 16;
    y = "2.3283064365386962890625e-10";
  }
  Ctor.precision += k;
  x2 = taylorSeries(Ctor, 1, x2.times(y), new Ctor(1));
  for (var i2 = k; i2--; ) {
    var cos2x = x2.times(x2);
    x2 = cos2x.times(cos2x).minus(cos2x).times(8).plus(1);
  }
  Ctor.precision -= k;
  return x2;
}
var divide = /* @__PURE__ */ (function() {
  function multiplyInteger(x2, k, base) {
    var temp, carry = 0, i2 = x2.length;
    for (x2 = x2.slice(); i2--; ) {
      temp = x2[i2] * k + carry;
      x2[i2] = temp % base | 0;
      carry = temp / base | 0;
    }
    if (carry) x2.unshift(carry);
    return x2;
  }
  function compare2(a, b, aL, bL) {
    var i2, r;
    if (aL != bL) {
      r = aL > bL ? 1 : -1;
    } else {
      for (i2 = r = 0; i2 < aL; i2++) {
        if (a[i2] != b[i2]) {
          r = a[i2] > b[i2] ? 1 : -1;
          break;
        }
      }
    }
    return r;
  }
  function subtract(a, b, aL, base) {
    var i2 = 0;
    for (; aL--; ) {
      a[aL] -= i2;
      i2 = a[aL] < b[aL] ? 1 : 0;
      a[aL] = i2 * base + a[aL] - b[aL];
    }
    for (; !a[0] && a.length > 1; ) a.shift();
  }
  return function(x2, y, pr, rm, dp, base) {
    var cmp, e, i2, k, logBase, more, prod, prodL, q, qd, rem, remL, rem0, sd, t, xi, xL, yd0, yL, yz, Ctor = x2.constructor, sign2 = x2.s == y.s ? 1 : -1, xd = x2.d, yd = y.d;
    if (!xd || !xd[0] || !yd || !yd[0]) {
      return new Ctor(
        // Return NaN if either NaN, or both Infinity or 0.
        !x2.s || !y.s || (xd ? yd && xd[0] == yd[0] : !yd) ? NaN : (
          // Return ±0 if x is 0 or y is ±Infinity, or return ±Infinity as y is 0.
          xd && xd[0] == 0 || !yd ? sign2 * 0 : sign2 / 0
        )
      );
    }
    if (base) {
      logBase = 1;
      e = x2.e - y.e;
    } else {
      base = BASE;
      logBase = LOG_BASE;
      e = mathfloor(x2.e / logBase) - mathfloor(y.e / logBase);
    }
    yL = yd.length;
    xL = xd.length;
    q = new Ctor(sign2);
    qd = q.d = [];
    for (i2 = 0; yd[i2] == (xd[i2] || 0); i2++) ;
    if (yd[i2] > (xd[i2] || 0)) e--;
    if (pr == null) {
      sd = pr = Ctor.precision;
      rm = Ctor.rounding;
    } else if (dp) {
      sd = pr + (x2.e - y.e) + 1;
    } else {
      sd = pr;
    }
    if (sd < 0) {
      qd.push(1);
      more = true;
    } else {
      sd = sd / logBase + 2 | 0;
      i2 = 0;
      if (yL == 1) {
        k = 0;
        yd = yd[0];
        sd++;
        for (; (i2 < xL || k) && sd--; i2++) {
          t = k * base + (xd[i2] || 0);
          qd[i2] = t / yd | 0;
          k = t % yd | 0;
        }
        more = k || i2 < xL;
      } else {
        k = base / (yd[0] + 1) | 0;
        if (k > 1) {
          yd = multiplyInteger(yd, k, base);
          xd = multiplyInteger(xd, k, base);
          yL = yd.length;
          xL = xd.length;
        }
        xi = yL;
        rem = xd.slice(0, yL);
        remL = rem.length;
        for (; remL < yL; ) rem[remL++] = 0;
        yz = yd.slice();
        yz.unshift(0);
        yd0 = yd[0];
        if (yd[1] >= base / 2) ++yd0;
        do {
          k = 0;
          cmp = compare2(yd, rem, yL, remL);
          if (cmp < 0) {
            rem0 = rem[0];
            if (yL != remL) rem0 = rem0 * base + (rem[1] || 0);
            k = rem0 / yd0 | 0;
            if (k > 1) {
              if (k >= base) k = base - 1;
              prod = multiplyInteger(yd, k, base);
              prodL = prod.length;
              remL = rem.length;
              cmp = compare2(prod, rem, prodL, remL);
              if (cmp == 1) {
                k--;
                subtract(prod, yL < prodL ? yz : yd, prodL, base);
              }
            } else {
              if (k == 0) cmp = k = 1;
              prod = yd.slice();
            }
            prodL = prod.length;
            if (prodL < remL) prod.unshift(0);
            subtract(rem, prod, remL, base);
            if (cmp == -1) {
              remL = rem.length;
              cmp = compare2(yd, rem, yL, remL);
              if (cmp < 1) {
                k++;
                subtract(rem, yL < remL ? yz : yd, remL, base);
              }
            }
            remL = rem.length;
          } else if (cmp === 0) {
            k++;
            rem = [0];
          }
          qd[i2++] = k;
          if (cmp && rem[0]) {
            rem[remL++] = xd[xi] || 0;
          } else {
            rem = [xd[xi]];
            remL = 1;
          }
        } while ((xi++ < xL || rem[0] !== void 0) && sd--);
        more = rem[0] !== void 0;
      }
      if (!qd[0]) qd.shift();
    }
    if (logBase == 1) {
      q.e = e;
      inexact = more;
    } else {
      for (i2 = 1, k = qd[0]; k >= 10; k /= 10) i2++;
      q.e = i2 + e * logBase - 1;
      finalise(q, dp ? pr + q.e + 1 : pr, rm, more);
    }
    return q;
  };
})();
function finalise(x2, sd, rm, isTruncated) {
  var digits, i2, j, k, rd, roundUp, w, xd, xdi, Ctor = x2.constructor;
  out: if (sd != null) {
    xd = x2.d;
    if (!xd) return x2;
    for (digits = 1, k = xd[0]; k >= 10; k /= 10) digits++;
    i2 = sd - digits;
    if (i2 < 0) {
      i2 += LOG_BASE;
      j = sd;
      w = xd[xdi = 0];
      rd = w / mathpow(10, digits - j - 1) % 10 | 0;
    } else {
      xdi = Math.ceil((i2 + 1) / LOG_BASE);
      k = xd.length;
      if (xdi >= k) {
        if (isTruncated) {
          for (; k++ <= xdi; ) xd.push(0);
          w = rd = 0;
          digits = 1;
          i2 %= LOG_BASE;
          j = i2 - LOG_BASE + 1;
        } else {
          break out;
        }
      } else {
        w = k = xd[xdi];
        for (digits = 1; k >= 10; k /= 10) digits++;
        i2 %= LOG_BASE;
        j = i2 - LOG_BASE + digits;
        rd = j < 0 ? 0 : w / mathpow(10, digits - j - 1) % 10 | 0;
      }
    }
    isTruncated = isTruncated || sd < 0 || xd[xdi + 1] !== void 0 || (j < 0 ? w : w % mathpow(10, digits - j - 1));
    roundUp = rm < 4 ? (rd || isTruncated) && (rm == 0 || rm == (x2.s < 0 ? 3 : 2)) : rd > 5 || rd == 5 && (rm == 4 || isTruncated || rm == 6 && // Check whether the digit to the left of the rounding digit is odd.
    (i2 > 0 ? j > 0 ? w / mathpow(10, digits - j) : 0 : xd[xdi - 1]) % 10 & 1 || rm == (x2.s < 0 ? 8 : 7));
    if (sd < 1 || !xd[0]) {
      xd.length = 0;
      if (roundUp) {
        sd -= x2.e + 1;
        xd[0] = mathpow(10, (LOG_BASE - sd % LOG_BASE) % LOG_BASE);
        x2.e = -sd || 0;
      } else {
        xd[0] = x2.e = 0;
      }
      return x2;
    }
    if (i2 == 0) {
      xd.length = xdi;
      k = 1;
      xdi--;
    } else {
      xd.length = xdi + 1;
      k = mathpow(10, LOG_BASE - i2);
      xd[xdi] = j > 0 ? (w / mathpow(10, digits - j) % mathpow(10, j) | 0) * k : 0;
    }
    if (roundUp) {
      for (; ; ) {
        if (xdi == 0) {
          for (i2 = 1, j = xd[0]; j >= 10; j /= 10) i2++;
          j = xd[0] += k;
          for (k = 1; j >= 10; j /= 10) k++;
          if (i2 != k) {
            x2.e++;
            if (xd[0] == BASE) xd[0] = 1;
          }
          break;
        } else {
          xd[xdi] += k;
          if (xd[xdi] != BASE) break;
          xd[xdi--] = 0;
          k = 1;
        }
      }
    }
    for (i2 = xd.length; xd[--i2] === 0; ) xd.pop();
  }
  if (external) {
    if (x2.e > Ctor.maxE) {
      x2.d = null;
      x2.e = NaN;
    } else if (x2.e < Ctor.minE) {
      x2.e = 0;
      x2.d = [0];
    }
  }
  return x2;
}
function finiteToString(x2, isExp, sd) {
  if (!x2.isFinite()) return nonFiniteToString(x2);
  var k, e = x2.e, str = digitsToString(x2.d), len = str.length;
  if (isExp) {
    if (sd && (k = sd - len) > 0) {
      str = str.charAt(0) + "." + str.slice(1) + getZeroString(k);
    } else if (len > 1) {
      str = str.charAt(0) + "." + str.slice(1);
    }
    str = str + (x2.e < 0 ? "e" : "e+") + x2.e;
  } else if (e < 0) {
    str = "0." + getZeroString(-e - 1) + str;
    if (sd && (k = sd - len) > 0) str += getZeroString(k);
  } else if (e >= len) {
    str += getZeroString(e + 1 - len);
    if (sd && (k = sd - e - 1) > 0) str = str + "." + getZeroString(k);
  } else {
    if ((k = e + 1) < len) str = str.slice(0, k) + "." + str.slice(k);
    if (sd && (k = sd - len) > 0) {
      if (e + 1 === len) str += ".";
      str += getZeroString(k);
    }
  }
  return str;
}
function getBase10Exponent(digits, e) {
  var w = digits[0];
  for (e *= LOG_BASE; w >= 10; w /= 10) e++;
  return e;
}
function getLn10(Ctor, sd, pr) {
  if (sd > LN10_PRECISION) {
    external = true;
    if (pr) Ctor.precision = pr;
    throw Error(precisionLimitExceeded);
  }
  return finalise(new Ctor(LN10), sd, 1, true);
}
function getPi(Ctor, sd, rm) {
  if (sd > PI_PRECISION) throw Error(precisionLimitExceeded);
  return finalise(new Ctor(PI), sd, rm, true);
}
function getPrecision(digits) {
  var w = digits.length - 1, len = w * LOG_BASE + 1;
  w = digits[w];
  if (w) {
    for (; w % 10 == 0; w /= 10) len--;
    for (w = digits[0]; w >= 10; w /= 10) len++;
  }
  return len;
}
function getZeroString(k) {
  var zs = "";
  for (; k--; ) zs += "0";
  return zs;
}
function intPow(Ctor, x2, n, pr) {
  var isTruncated, r = new Ctor(1), k = Math.ceil(pr / LOG_BASE + 4);
  external = false;
  for (; ; ) {
    if (n % 2) {
      r = r.times(x2);
      if (truncate(r.d, k)) isTruncated = true;
    }
    n = mathfloor(n / 2);
    if (n === 0) {
      n = r.d.length - 1;
      if (isTruncated && r.d[n] === 0) ++r.d[n];
      break;
    }
    x2 = x2.times(x2);
    truncate(x2.d, k);
  }
  external = true;
  return r;
}
function isOdd(n) {
  return n.d[n.d.length - 1] & 1;
}
function maxOrMin(Ctor, args, n) {
  var k, y, x2 = new Ctor(args[0]), i2 = 0;
  for (; ++i2 < args.length; ) {
    y = new Ctor(args[i2]);
    if (!y.s) {
      x2 = y;
      break;
    }
    k = x2.cmp(y);
    if (k === n || k === 0 && x2.s === n) {
      x2 = y;
    }
  }
  return x2;
}
function naturalExponential(x2, sd) {
  var denominator, guard, j, pow2, sum4, t, wpr, rep = 0, i2 = 0, k = 0, Ctor = x2.constructor, rm = Ctor.rounding, pr = Ctor.precision;
  if (!x2.d || !x2.d[0] || x2.e > 17) {
    return new Ctor(x2.d ? !x2.d[0] ? 1 : x2.s < 0 ? 0 : 1 / 0 : x2.s ? x2.s < 0 ? 0 : x2 : 0 / 0);
  }
  if (sd == null) {
    external = false;
    wpr = pr;
  } else {
    wpr = sd;
  }
  t = new Ctor(0.03125);
  while (x2.e > -2) {
    x2 = x2.times(t);
    k += 5;
  }
  guard = Math.log(mathpow(2, k)) / Math.LN10 * 2 + 5 | 0;
  wpr += guard;
  denominator = pow2 = sum4 = new Ctor(1);
  Ctor.precision = wpr;
  for (; ; ) {
    pow2 = finalise(pow2.times(x2), wpr, 1);
    denominator = denominator.times(++i2);
    t = sum4.plus(divide(pow2, denominator, wpr, 1));
    if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum4.d).slice(0, wpr)) {
      j = k;
      while (j--) sum4 = finalise(sum4.times(sum4), wpr, 1);
      if (sd == null) {
        if (rep < 3 && checkRoundingDigits(sum4.d, wpr - guard, rm, rep)) {
          Ctor.precision = wpr += 10;
          denominator = pow2 = t = new Ctor(1);
          i2 = 0;
          rep++;
        } else {
          return finalise(sum4, Ctor.precision = pr, rm, external = true);
        }
      } else {
        Ctor.precision = pr;
        return sum4;
      }
    }
    sum4 = t;
  }
}
function naturalLogarithm(y, sd) {
  var c, c0, denominator, e, numerator, rep, sum4, t, wpr, x1, x2, n = 1, guard = 10, x3 = y, xd = x3.d, Ctor = x3.constructor, rm = Ctor.rounding, pr = Ctor.precision;
  if (x3.s < 0 || !xd || !xd[0] || !x3.e && xd[0] == 1 && xd.length == 1) {
    return new Ctor(xd && !xd[0] ? -1 / 0 : x3.s != 1 ? NaN : xd ? 0 : x3);
  }
  if (sd == null) {
    external = false;
    wpr = pr;
  } else {
    wpr = sd;
  }
  Ctor.precision = wpr += guard;
  c = digitsToString(xd);
  c0 = c.charAt(0);
  if (Math.abs(e = x3.e) < 15e14) {
    while (c0 < 7 && c0 != 1 || c0 == 1 && c.charAt(1) > 3) {
      x3 = x3.times(y);
      c = digitsToString(x3.d);
      c0 = c.charAt(0);
      n++;
    }
    e = x3.e;
    if (c0 > 1) {
      x3 = new Ctor("0." + c);
      e++;
    } else {
      x3 = new Ctor(c0 + "." + c.slice(1));
    }
  } else {
    t = getLn10(Ctor, wpr + 2, pr).times(e + "");
    x3 = naturalLogarithm(new Ctor(c0 + "." + c.slice(1)), wpr - guard).plus(t);
    Ctor.precision = pr;
    return sd == null ? finalise(x3, pr, rm, external = true) : x3;
  }
  x1 = x3;
  sum4 = numerator = x3 = divide(x3.minus(1), x3.plus(1), wpr, 1);
  x2 = finalise(x3.times(x3), wpr, 1);
  denominator = 3;
  for (; ; ) {
    numerator = finalise(numerator.times(x2), wpr, 1);
    t = sum4.plus(divide(numerator, new Ctor(denominator), wpr, 1));
    if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum4.d).slice(0, wpr)) {
      sum4 = sum4.times(2);
      if (e !== 0) sum4 = sum4.plus(getLn10(Ctor, wpr + 2, pr).times(e + ""));
      sum4 = divide(sum4, new Ctor(n), wpr, 1);
      if (sd == null) {
        if (checkRoundingDigits(sum4.d, wpr - guard, rm, rep)) {
          Ctor.precision = wpr += guard;
          t = numerator = x3 = divide(x1.minus(1), x1.plus(1), wpr, 1);
          x2 = finalise(x3.times(x3), wpr, 1);
          denominator = rep = 1;
        } else {
          return finalise(sum4, Ctor.precision = pr, rm, external = true);
        }
      } else {
        Ctor.precision = pr;
        return sum4;
      }
    }
    sum4 = t;
    denominator += 2;
  }
}
function nonFiniteToString(x2) {
  return String(x2.s * x2.s / 0);
}
function parseDecimal(x2, str) {
  var e, i2, len;
  if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
  if ((i2 = str.search(/e/i)) > 0) {
    if (e < 0) e = i2;
    e += +str.slice(i2 + 1);
    str = str.substring(0, i2);
  } else if (e < 0) {
    e = str.length;
  }
  for (i2 = 0; str.charCodeAt(i2) === 48; i2++) ;
  for (len = str.length; str.charCodeAt(len - 1) === 48; --len) ;
  str = str.slice(i2, len);
  if (str) {
    len -= i2;
    x2.e = e = e - i2 - 1;
    x2.d = [];
    i2 = (e + 1) % LOG_BASE;
    if (e < 0) i2 += LOG_BASE;
    if (i2 < len) {
      if (i2) x2.d.push(+str.slice(0, i2));
      for (len -= LOG_BASE; i2 < len; ) x2.d.push(+str.slice(i2, i2 += LOG_BASE));
      str = str.slice(i2);
      i2 = LOG_BASE - str.length;
    } else {
      i2 -= len;
    }
    for (; i2--; ) str += "0";
    x2.d.push(+str);
    if (external) {
      if (x2.e > x2.constructor.maxE) {
        x2.d = null;
        x2.e = NaN;
      } else if (x2.e < x2.constructor.minE) {
        x2.e = 0;
        x2.d = [0];
      }
    }
  } else {
    x2.e = 0;
    x2.d = [0];
  }
  return x2;
}
function parseOther(x2, str) {
  var base, Ctor, divisor, i2, isFloat, len, p, xd, xe;
  if (str.indexOf("_") > -1) {
    str = str.replace(/(\d)_(?=\d)/g, "$1");
    if (isDecimal.test(str)) return parseDecimal(x2, str);
  } else if (str === "Infinity" || str === "NaN") {
    if (!+str) x2.s = NaN;
    x2.e = NaN;
    x2.d = null;
    return x2;
  }
  if (isHex.test(str)) {
    base = 16;
    str = str.toLowerCase();
  } else if (isBinary.test(str)) {
    base = 2;
  } else if (isOctal.test(str)) {
    base = 8;
  } else {
    throw Error(invalidArgument + str);
  }
  i2 = str.search(/p/i);
  if (i2 > 0) {
    p = +str.slice(i2 + 1);
    str = str.substring(2, i2);
  } else {
    str = str.slice(2);
  }
  i2 = str.indexOf(".");
  isFloat = i2 >= 0;
  Ctor = x2.constructor;
  if (isFloat) {
    str = str.replace(".", "");
    len = str.length;
    i2 = len - i2;
    divisor = intPow(Ctor, new Ctor(base), i2, i2 * 2);
  }
  xd = convertBase(str, base, BASE);
  xe = xd.length - 1;
  for (i2 = xe; xd[i2] === 0; --i2) xd.pop();
  if (i2 < 0) return new Ctor(x2.s * 0);
  x2.e = getBase10Exponent(xd, xe);
  x2.d = xd;
  external = false;
  if (isFloat) x2 = divide(x2, divisor, len * 4);
  if (p) x2 = x2.times(Math.abs(p) < 54 ? mathpow(2, p) : Decimal.pow(2, p));
  external = true;
  return x2;
}
function sine(Ctor, x2) {
  var k, len = x2.d.length;
  if (len < 3) {
    return x2.isZero() ? x2 : taylorSeries(Ctor, 2, x2, x2);
  }
  k = 1.4 * Math.sqrt(len);
  k = k > 16 ? 16 : k | 0;
  x2 = x2.times(1 / tinyPow(5, k));
  x2 = taylorSeries(Ctor, 2, x2, x2);
  var sin2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
  for (; k--; ) {
    sin2_x = x2.times(x2);
    x2 = x2.times(d5.plus(sin2_x.times(d16.times(sin2_x).minus(d20))));
  }
  return x2;
}
function taylorSeries(Ctor, n, x2, y, isHyperbolic) {
  var j, t, u, x22, i2 = 1, pr = Ctor.precision, k = Math.ceil(pr / LOG_BASE);
  external = false;
  x22 = x2.times(x2);
  u = new Ctor(y);
  for (; ; ) {
    t = divide(u.times(x22), new Ctor(n++ * n++), pr, 1);
    u = isHyperbolic ? y.plus(t) : y.minus(t);
    y = divide(t.times(x22), new Ctor(n++ * n++), pr, 1);
    t = u.plus(y);
    if (t.d[k] !== void 0) {
      for (j = k; t.d[j] === u.d[j] && j--; ) ;
      if (j == -1) break;
    }
    j = u;
    u = y;
    y = t;
    t = j;
    i2++;
  }
  external = true;
  t.d.length = k + 1;
  return t;
}
function tinyPow(b, e) {
  var n = b;
  while (--e) n *= b;
  return n;
}
function toLessThanHalfPi(Ctor, x2) {
  var t, isNeg = x2.s < 0, pi = getPi(Ctor, Ctor.precision, 1), halfPi = pi.times(0.5);
  x2 = x2.abs();
  if (x2.lte(halfPi)) {
    quadrant = isNeg ? 4 : 1;
    return x2;
  }
  t = x2.divToInt(pi);
  if (t.isZero()) {
    quadrant = isNeg ? 3 : 2;
  } else {
    x2 = x2.minus(t.times(pi));
    if (x2.lte(halfPi)) {
      quadrant = isOdd(t) ? isNeg ? 2 : 3 : isNeg ? 4 : 1;
      return x2;
    }
    quadrant = isOdd(t) ? isNeg ? 1 : 4 : isNeg ? 3 : 2;
  }
  return x2.minus(pi).abs();
}
function toStringBinary(x2, baseOut, sd, rm) {
  var base, e, i2, k, len, roundUp, str, xd, y, Ctor = x2.constructor, isExp = sd !== void 0;
  if (isExp) {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
  } else {
    sd = Ctor.precision;
    rm = Ctor.rounding;
  }
  if (!x2.isFinite()) {
    str = nonFiniteToString(x2);
  } else {
    str = finiteToString(x2);
    i2 = str.indexOf(".");
    if (isExp) {
      base = 2;
      if (baseOut == 16) {
        sd = sd * 4 - 3;
      } else if (baseOut == 8) {
        sd = sd * 3 - 2;
      }
    } else {
      base = baseOut;
    }
    if (i2 >= 0) {
      str = str.replace(".", "");
      y = new Ctor(1);
      y.e = str.length - i2;
      y.d = convertBase(finiteToString(y), 10, base);
      y.e = y.d.length;
    }
    xd = convertBase(str, 10, base);
    e = len = xd.length;
    for (; xd[--len] == 0; ) xd.pop();
    if (!xd[0]) {
      str = isExp ? "0p+0" : "0";
    } else {
      if (i2 < 0) {
        e--;
      } else {
        x2 = new Ctor(x2);
        x2.d = xd;
        x2.e = e;
        x2 = divide(x2, y, sd, rm, 0, base);
        xd = x2.d;
        e = x2.e;
        roundUp = inexact;
      }
      i2 = xd[sd];
      k = base / 2;
      roundUp = roundUp || xd[sd + 1] !== void 0;
      roundUp = rm < 4 ? (i2 !== void 0 || roundUp) && (rm === 0 || rm === (x2.s < 0 ? 3 : 2)) : i2 > k || i2 === k && (rm === 4 || roundUp || rm === 6 && xd[sd - 1] & 1 || rm === (x2.s < 0 ? 8 : 7));
      xd.length = sd;
      if (roundUp) {
        for (; ++xd[--sd] > base - 1; ) {
          xd[sd] = 0;
          if (!sd) {
            ++e;
            xd.unshift(1);
          }
        }
      }
      for (len = xd.length; !xd[len - 1]; --len) ;
      for (i2 = 0, str = ""; i2 < len; i2++) str += NUMERALS.charAt(xd[i2]);
      if (isExp) {
        if (len > 1) {
          if (baseOut == 16 || baseOut == 8) {
            i2 = baseOut == 16 ? 4 : 3;
            for (--len; len % i2; len++) str += "0";
            xd = convertBase(str, base, baseOut);
            for (len = xd.length; !xd[len - 1]; --len) ;
            for (i2 = 1, str = "1."; i2 < len; i2++) str += NUMERALS.charAt(xd[i2]);
          } else {
            str = str.charAt(0) + "." + str.slice(1);
          }
        }
        str = str + (e < 0 ? "p" : "p+") + e;
      } else if (e < 0) {
        for (; ++e; ) str = "0" + str;
        str = "0." + str;
      } else {
        if (++e > len) for (e -= len; e--; ) str += "0";
        else if (e < len) str = str.slice(0, e) + "." + str.slice(e);
      }
    }
    str = (baseOut == 16 ? "0x" : baseOut == 2 ? "0b" : baseOut == 8 ? "0o" : "") + str;
  }
  return x2.s < 0 ? "-" + str : str;
}
function truncate(arr2, len) {
  if (arr2.length > len) {
    arr2.length = len;
    return true;
  }
}
function abs(x2) {
  return new this(x2).abs();
}
function acos(x2) {
  return new this(x2).acos();
}
function acosh(x2) {
  return new this(x2).acosh();
}
function add(x2, y) {
  return new this(x2).plus(y);
}
function asin(x2) {
  return new this(x2).asin();
}
function asinh(x2) {
  return new this(x2).asinh();
}
function atan(x2) {
  return new this(x2).atan();
}
function atanh(x2) {
  return new this(x2).atanh();
}
function atan2(y, x2) {
  y = new this(y);
  x2 = new this(x2);
  var r, pr = this.precision, rm = this.rounding, wpr = pr + 4;
  if (!y.s || !x2.s) {
    r = new this(NaN);
  } else if (!y.d && !x2.d) {
    r = getPi(this, wpr, 1).times(x2.s > 0 ? 0.25 : 0.75);
    r.s = y.s;
  } else if (!x2.d || y.isZero()) {
    r = x2.s < 0 ? getPi(this, pr, rm) : new this(0);
    r.s = y.s;
  } else if (!y.d || x2.isZero()) {
    r = getPi(this, wpr, 1).times(0.5);
    r.s = y.s;
  } else if (x2.s < 0) {
    this.precision = wpr;
    this.rounding = 1;
    r = this.atan(divide(y, x2, wpr, 1));
    x2 = getPi(this, wpr, 1);
    this.precision = pr;
    this.rounding = rm;
    r = y.s < 0 ? r.minus(x2) : r.plus(x2);
  } else {
    r = this.atan(divide(y, x2, wpr, 1));
  }
  return r;
}
function cbrt(x2) {
  return new this(x2).cbrt();
}
function ceil(x2) {
  return finalise(x2 = new this(x2), x2.e + 1, 2);
}
function clamp(x2, min2, max3) {
  return new this(x2).clamp(min2, max3);
}
function config(obj) {
  if (!obj || typeof obj !== "object") throw Error(decimalError + "Object expected");
  var i2, p, v, useDefaults = obj.defaults === true, ps = [
    "precision",
    1,
    MAX_DIGITS,
    "rounding",
    0,
    8,
    "toExpNeg",
    -EXP_LIMIT,
    0,
    "toExpPos",
    0,
    EXP_LIMIT,
    "maxE",
    0,
    EXP_LIMIT,
    "minE",
    -EXP_LIMIT,
    0,
    "modulo",
    0,
    9
  ];
  for (i2 = 0; i2 < ps.length; i2 += 3) {
    if (p = ps[i2], useDefaults) this[p] = DEFAULTS[p];
    if ((v = obj[p]) !== void 0) {
      if (mathfloor(v) === v && v >= ps[i2 + 1] && v <= ps[i2 + 2]) this[p] = v;
      else throw Error(invalidArgument + p + ": " + v);
    }
  }
  if (p = "crypto", useDefaults) this[p] = DEFAULTS[p];
  if ((v = obj[p]) !== void 0) {
    if (v === true || v === false || v === 0 || v === 1) {
      if (v) {
        if (typeof crypto != "undefined" && crypto && (crypto.getRandomValues || crypto.randomBytes)) {
          this[p] = true;
        } else {
          throw Error(cryptoUnavailable);
        }
      } else {
        this[p] = false;
      }
    } else {
      throw Error(invalidArgument + p + ": " + v);
    }
  }
  return this;
}
function cos(x2) {
  return new this(x2).cos();
}
function cosh(x2) {
  return new this(x2).cosh();
}
function clone(obj) {
  var i2, p, ps;
  function Decimal2(v) {
    var e, i3, t, x2 = this;
    if (!(x2 instanceof Decimal2)) return new Decimal2(v);
    x2.constructor = Decimal2;
    if (isDecimalInstance(v)) {
      x2.s = v.s;
      if (external) {
        if (!v.d || v.e > Decimal2.maxE) {
          x2.e = NaN;
          x2.d = null;
        } else if (v.e < Decimal2.minE) {
          x2.e = 0;
          x2.d = [0];
        } else {
          x2.e = v.e;
          x2.d = v.d.slice();
        }
      } else {
        x2.e = v.e;
        x2.d = v.d ? v.d.slice() : v.d;
      }
      return;
    }
    t = typeof v;
    if (t === "number") {
      if (v === 0) {
        x2.s = 1 / v < 0 ? -1 : 1;
        x2.e = 0;
        x2.d = [0];
        return;
      }
      if (v < 0) {
        v = -v;
        x2.s = -1;
      } else {
        x2.s = 1;
      }
      if (v === ~~v && v < 1e7) {
        for (e = 0, i3 = v; i3 >= 10; i3 /= 10) e++;
        if (external) {
          if (e > Decimal2.maxE) {
            x2.e = NaN;
            x2.d = null;
          } else if (e < Decimal2.minE) {
            x2.e = 0;
            x2.d = [0];
          } else {
            x2.e = e;
            x2.d = [v];
          }
        } else {
          x2.e = e;
          x2.d = [v];
        }
        return;
      }
      if (v * 0 !== 0) {
        if (!v) x2.s = NaN;
        x2.e = NaN;
        x2.d = null;
        return;
      }
      return parseDecimal(x2, v.toString());
    }
    if (t === "string") {
      if ((i3 = v.charCodeAt(0)) === 45) {
        v = v.slice(1);
        x2.s = -1;
      } else {
        if (i3 === 43) v = v.slice(1);
        x2.s = 1;
      }
      return isDecimal.test(v) ? parseDecimal(x2, v) : parseOther(x2, v);
    }
    if (t === "bigint") {
      if (v < 0) {
        v = -v;
        x2.s = -1;
      } else {
        x2.s = 1;
      }
      return parseDecimal(x2, v.toString());
    }
    throw Error(invalidArgument + v);
  }
  Decimal2.prototype = P;
  Decimal2.ROUND_UP = 0;
  Decimal2.ROUND_DOWN = 1;
  Decimal2.ROUND_CEIL = 2;
  Decimal2.ROUND_FLOOR = 3;
  Decimal2.ROUND_HALF_UP = 4;
  Decimal2.ROUND_HALF_DOWN = 5;
  Decimal2.ROUND_HALF_EVEN = 6;
  Decimal2.ROUND_HALF_CEIL = 7;
  Decimal2.ROUND_HALF_FLOOR = 8;
  Decimal2.EUCLID = 9;
  Decimal2.config = Decimal2.set = config;
  Decimal2.clone = clone;
  Decimal2.isDecimal = isDecimalInstance;
  Decimal2.abs = abs;
  Decimal2.acos = acos;
  Decimal2.acosh = acosh;
  Decimal2.add = add;
  Decimal2.asin = asin;
  Decimal2.asinh = asinh;
  Decimal2.atan = atan;
  Decimal2.atanh = atanh;
  Decimal2.atan2 = atan2;
  Decimal2.cbrt = cbrt;
  Decimal2.ceil = ceil;
  Decimal2.clamp = clamp;
  Decimal2.cos = cos;
  Decimal2.cosh = cosh;
  Decimal2.div = div;
  Decimal2.exp = exp;
  Decimal2.floor = floor;
  Decimal2.hypot = hypot;
  Decimal2.ln = ln;
  Decimal2.log = log;
  Decimal2.log10 = log10;
  Decimal2.log2 = log2;
  Decimal2.max = max;
  Decimal2.min = min;
  Decimal2.mod = mod;
  Decimal2.mul = mul;
  Decimal2.pow = pow;
  Decimal2.random = random;
  Decimal2.round = round;
  Decimal2.sign = sign;
  Decimal2.sin = sin;
  Decimal2.sinh = sinh;
  Decimal2.sqrt = sqrt;
  Decimal2.sub = sub;
  Decimal2.sum = sum;
  Decimal2.tan = tan;
  Decimal2.tanh = tanh;
  Decimal2.trunc = trunc;
  if (obj === void 0) obj = {};
  if (obj) {
    if (obj.defaults !== true) {
      ps = ["precision", "rounding", "toExpNeg", "toExpPos", "maxE", "minE", "modulo", "crypto"];
      for (i2 = 0; i2 < ps.length; ) if (!obj.hasOwnProperty(p = ps[i2++])) obj[p] = this[p];
    }
  }
  Decimal2.config(obj);
  return Decimal2;
}
function div(x2, y) {
  return new this(x2).div(y);
}
function exp(x2) {
  return new this(x2).exp();
}
function floor(x2) {
  return finalise(x2 = new this(x2), x2.e + 1, 3);
}
function hypot() {
  var i2, n, t = new this(0);
  external = false;
  for (i2 = 0; i2 < arguments.length; ) {
    n = new this(arguments[i2++]);
    if (!n.d) {
      if (n.s) {
        external = true;
        return new this(1 / 0);
      }
      t = n;
    } else if (t.d) {
      t = t.plus(n.times(n));
    }
  }
  external = true;
  return t.sqrt();
}
function isDecimalInstance(obj) {
  return obj instanceof Decimal || obj && obj.toStringTag === tag || false;
}
function ln(x2) {
  return new this(x2).ln();
}
function log(x2, y) {
  return new this(x2).log(y);
}
function log2(x2) {
  return new this(x2).log(2);
}
function log10(x2) {
  return new this(x2).log(10);
}
function max() {
  return maxOrMin(this, arguments, -1);
}
function min() {
  return maxOrMin(this, arguments, 1);
}
function mod(x2, y) {
  return new this(x2).mod(y);
}
function mul(x2, y) {
  return new this(x2).mul(y);
}
function pow(x2, y) {
  return new this(x2).pow(y);
}
function random(sd) {
  var d, e, k, n, i2 = 0, r = new this(1), rd = [];
  if (sd === void 0) sd = this.precision;
  else checkInt32(sd, 1, MAX_DIGITS);
  k = Math.ceil(sd / LOG_BASE);
  if (!this.crypto) {
    for (; i2 < k; ) rd[i2++] = Math.random() * 1e7 | 0;
  } else if (crypto.getRandomValues) {
    d = crypto.getRandomValues(new Uint32Array(k));
    for (; i2 < k; ) {
      n = d[i2];
      if (n >= 429e7) {
        d[i2] = crypto.getRandomValues(new Uint32Array(1))[0];
      } else {
        rd[i2++] = n % 1e7;
      }
    }
  } else if (crypto.randomBytes) {
    d = crypto.randomBytes(k *= 4);
    for (; i2 < k; ) {
      n = d[i2] + (d[i2 + 1] << 8) + (d[i2 + 2] << 16) + ((d[i2 + 3] & 127) << 24);
      if (n >= 214e7) {
        crypto.randomBytes(4).copy(d, i2);
      } else {
        rd.push(n % 1e7);
        i2 += 4;
      }
    }
    i2 = k / 4;
  } else {
    throw Error(cryptoUnavailable);
  }
  k = rd[--i2];
  sd %= LOG_BASE;
  if (k && sd) {
    n = mathpow(10, LOG_BASE - sd);
    rd[i2] = (k / n | 0) * n;
  }
  for (; rd[i2] === 0; i2--) rd.pop();
  if (i2 < 0) {
    e = 0;
    rd = [0];
  } else {
    e = -1;
    for (; rd[0] === 0; e -= LOG_BASE) rd.shift();
    for (k = 1, n = rd[0]; n >= 10; n /= 10) k++;
    if (k < LOG_BASE) e -= LOG_BASE - k;
  }
  r.e = e;
  r.d = rd;
  return r;
}
function round(x2) {
  return finalise(x2 = new this(x2), x2.e + 1, this.rounding);
}
function sign(x2) {
  x2 = new this(x2);
  return x2.d ? x2.d[0] ? x2.s : 0 * x2.s : x2.s || NaN;
}
function sin(x2) {
  return new this(x2).sin();
}
function sinh(x2) {
  return new this(x2).sinh();
}
function sqrt(x2) {
  return new this(x2).sqrt();
}
function sub(x2, y) {
  return new this(x2).sub(y);
}
function sum() {
  var i2 = 0, args = arguments, x2 = new this(args[i2]);
  external = false;
  for (; x2.s && ++i2 < args.length; ) x2 = x2.plus(args[i2]);
  external = true;
  return finalise(x2, this.precision, this.rounding);
}
function tan(x2) {
  return new this(x2).tan();
}
function tanh(x2) {
  return new this(x2).tanh();
}
function trunc(x2) {
  return finalise(x2 = new this(x2), x2.e + 1, 1);
}
P[/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")] = P.toString;
P[Symbol.toStringTag] = "Decimal";
var Decimal = P.constructor = clone(DEFAULTS);
LN10 = new Decimal(LN10);
PI = new Decimal(PI);
var decimal_default = Decimal;

// server/profit/decimal.mjs
var D = decimal_default.clone({ precision: 40, rounding: decimal_default.ROUND_HALF_UP });
var money = (x2) => x2 == null ? null : new D(x2).toDecimalPlaces(2).toFixed(2);
var six = (x2) => new D(x2).toDecimalPlaces(6);
var sum2 = (xs) => xs.some((x2) => x2 == null) ? null : xs.reduce((s, x2) => s.plus(x2), new D(0));
var valid = (r) => ["已确认", "模拟确认", "暂估", "不适用"].includes(r.status);

// server/profit/baseline.mjs
function prepareBaseline(dataset) {
  const { order: o, baseline: b } = dataset;
  const p = b.params;
  const q = sum2(b.recipe.map((m) => m.quantity));
  const ref = sum2(b.recipe.map((m) => m.quantity == null || m.referencePrice == null ? null : new D(m.quantity).times(m.referencePrice)));
  const available = q?.gt(0) && ref?.gt(0) && o.price != null && o.weight != null && new D(o.weight).gt(0) && p.material_pct != null;
  const factor = available ? new D(o.price).times(p.material_pct).div(o.weight).div(ref.div(q)) : null;
  const materials = b.recipe.map((m) => ({ ...m, share: available ? new D(m.quantity).div(q) : null, price: available ? six(new D(m.referencePrice).times(factor)) : null }));
  function theoretical(quantity, mode = "ideal") {
    const revenue = o.price == null || quantity == null ? null : new D(quantity).times(o.price);
    const material = quantity == null ? null : sum2(materials.map((m) => m.price == null ? null : new D(money(six(new D(quantity).times(o.weight).times(m.share)).times(m.price)))));
    const byQty = (k) => quantity == null || p[k] == null ? null : new D(money(new D(quantity).times(p[k])));
    const byRevenue = (k) => revenue == null || p[k] == null ? null : new D(money(revenue.times(p[k])));
    const labor = p.prep_piece == null || p.press_piece == null || quantity == null ? null : new D(money(new D(quantity).times(new D(p.prep_piece).plus(p.press_piece))));
    const management = byRevenue("production_mgmt"), energy = byRevenue("energy_pct"), otherProduction = byQty("other_production_piece");
    const reserve = mode === "budget" ? sum2([byRevenue("production_loss_budget"), byRevenue("defect_loss_budget")]) : new D(0);
    const production = sum2([material, labor, management, energy, otherProduction, reserve]);
    const gross = revenue != null && production != null ? revenue.minus(production) : null;
    const operatingCosts = sum2([byRevenue("company_mgmt"), byRevenue("admin_pct"), byQty("logistics_piece"), byQty("finance_piece")]);
    const operating = gross != null && operatingCosts != null ? gross.minus(operatingCosts) : null;
    return { revenue: money(revenue), material: money(material), labor: money(labor), manufacturing: money(sum2([management, energy])), productionManagement: money(management), energy: money(energy), otherProduction: money(otherProduction), reserve: money(reserve), operatingCosts: money(operatingCosts), gross: money(gross), operating: money(operating) };
  }
  return { materials, theoretical };
}

// server/profit/diagnosis.mjs
var DIAGNOSIS_RULE_VERSION = "DIAG-1.0";
var REFERENCE_RULE_VERSION = "REF-1.0";
var SEVERITY_RULE_VERSION = "SEV-1.0";
var PRIMARY_SHARE_THRESHOLD = "0.60";
var SEVERITY_THRESHOLDS = { normalMax: "0.10", attentionMax: "0.20", keyMax: "0.30" };
var dec = (v) => v == null || v === "" ? null : new D(v);
var amount = (d, places = 2) => d == null ? null : d.toFixed(places);
var ratio = (d) => d == null ? null : d.toFixed(8);
var pp = (d) => d == null ? null : d.times(100).toFixed(2);
var COMPONENTS = {
  materialPrice: {
    label: "材料价格",
    kind: "production",
    increase: "实际采购单价合计高于理论基准，增加差距。",
    offset: "实际采购单价合计低于理论基准，抵消差距。",
    suggestion: "核对采购单价、供应商报价和调价生效日期，确认是否存在未同步到理论基准的涨价。",
    evidence: "每日材料记录（净耗、单价）"
  },
  materialUsage: {
    label: "材料耗用",
    kind: "production",
    increase: "实际材料净耗高于同进度标准，增加差距。",
    offset: "实际材料净耗低于同进度标准，抵消差距。",
    suggestion: "核对领退料、配方重量、计量口径和不良品耗料记录，确认净耗偏高的具体批次。",
    evidence: "每日材料记录、原订单配方"
  },
  labor: {
    label: "人工",
    kind: "production",
    increase: "实际人工费用高于同进度标准，增加差距。",
    offset: "实际人工费用低于同进度标准，抵消差距。",
    suggestion: "核对工价、计件量和人工归属期间，确认人工费用偏高的具体工序。",
    evidence: "每日费用（人工）"
  },
  energy: {
    label: "能源",
    kind: "production",
    increase: "实际能源费用高于同进度标准，增加差距。",
    offset: "实际能源费用低于同进度标准，抵消差距。",
    suggestion: "核对能源抄表、单价和分摊口径。",
    evidence: "每日费用（制造·能源）"
  },
  otherManufacturing: {
    label: "其他制造",
    kind: "production",
    increase: "实际其他制造费用高于同进度标准，增加差距。",
    offset: "实际其他制造费用低于同进度标准，抵消差距。",
    suggestion: "核对制造费用项目、分摊口径与归属期间。",
    evidence: "每日费用（制造）"
  },
  otherProduction: {
    label: "其他生产",
    kind: "production",
    increase: "实际其他生产费用高于同进度标准，增加差距。",
    offset: "实际其他生产费用低于同进度标准，抵消差距。",
    suggestion: "核对其他生产费用项目与归属期间。",
    evidence: "每日费用（其他生产）"
  },
  budgetAdjustment: {
    label: "预算允许损耗",
    kind: "baseline",
    increase: "预算允许损耗按基线计提，属于对照口径调整。",
    offset: "预算允许损耗按基线计提，属于对照口径调整。",
    suggestion: null,
    evidence: "成本计算中的生产损耗与不良损耗预算"
  },
  rounding: {
    label: "舍入调整",
    kind: "rounding",
    increase: "舍入调整，仅用于金额闭合。",
    offset: "舍入调整，仅用于金额闭合。",
    suggestion: null,
    evidence: "逐日舍入后的差值"
  }
};
function classify(component, value) {
  if (value == null) return { effect: "unknown", fact: "该项资料待补齐，暂不判断。" };
  if (value.isZero()) return { effect: "neutral", fact: "该项净影响为零。" };
  const meta = COMPONENTS[component];
  return { effect: value.gt(0) ? "increase" : "offset", fact: value.gt(0) ? meta.increase : meta.offset };
}
function referenceItem({ key, label, formula, unit: unit2, actual, threshold, actualKnown, thresholdKnown, reasons, basis, source, applicability, compare: compare2 }) {
  const known = actualKnown && thresholdKnown && actual != null && threshold != null;
  const breached = known ? compare2(actual, threshold) : null;
  return {
    key,
    label,
    status: known ? "known" : "unknown",
    actualKnown,
    thresholdKnown,
    actual: ratio(actual),
    threshold: ratio(threshold),
    breached,
    gapPp: known ? pp(actual.minus(threshold).abs()) : null,
    relation: known ? breached ? key === "margin" ? "below" : "above" : key === "margin" ? "at_or_above" : "at_or_below" : null,
    reasons,
    formula,
    unit: unit2,
    basis,
    source,
    applicability
  };
}
function buildReferenceThresholds({ order, cumulative, theoreticalBudget, baselineId, asOf } = {}) {
  const revenue = dec(theoreticalBudget?.revenue);
  const gross = dec(theoreticalBudget?.gross);
  const actualMargin = dec(cumulative?.actual?.margin);
  const marginReasons = [];
  if (actualMargin == null) marginReasons.push("累计实际毛利率待补齐");
  if (revenue == null) marginReasons.push("预算理论收入待补齐");
  else if (revenue.lte(0)) marginReasons.push("预算理论收入为零，不能作为分母");
  if (gross == null) marginReasons.push("预算理论毛利待补齐");
  const marginThreshold = revenue != null && revenue.gt(0) && gross != null ? gross.div(revenue) : null;
  const margin = referenceItem({
    key: "margin",
    label: "毛利率",
    formula: "预算理论毛利 ÷ 预算理论收入",
    unit: "比例",
    actual: actualMargin,
    threshold: marginThreshold,
    actualKnown: actualMargin != null,
    thresholdKnown: marginThreshold != null,
    reasons: marginReasons,
    basis: { revenue: amount(revenue), gross: amount(gross) },
    source: "成本模型 · 含损耗预算基线",
    applicability: "仅作预算模型参考，不是已核定的企业安全底线。",
    compare: (a, t) => a.lt(t)
  });
  const quantity = dec(order?.quantity);
  const reserve = dec(theoreticalBudget?.reserve);
  const material = dec(theoreticalBudget?.material);
  const labor = dec(theoreticalBudget?.labor);
  const processed = dec(cumulative?.processed);
  const defects = dec(cumulative?.defects);
  const actualDefect = processed != null && processed.gt(0) && defects != null ? defects.div(processed) : null;
  const defectReasons = [];
  if (actualDefect == null) {
    if (processed == null) defectReasons.push("累计加工量待补齐");
    else if (processed.lte(0)) defectReasons.push("累计加工量为零，不能作为分母");
    if (defects == null) defectReasons.push("累计不良量待补齐");
  }
  if (quantity == null) defectReasons.push("合同数量待补齐");
  else if (quantity.lte(0)) defectReasons.push("合同数量为零，不能作为分母");
  if (reserve == null) defectReasons.push("预算损耗准备金待补齐");
  else if (reserve.lt(0)) defectReasons.push("预算损耗准备金为负，不能推导参考阈值");
  if (material == null) defectReasons.push("预算材料成本待补齐");
  else if (material.lt(0)) defectReasons.push("预算材料成本为负，不能推导参考阈值");
  if (labor == null) defectReasons.push("预算人工成本待补齐");
  else if (labor.lt(0)) defectReasons.push("预算人工成本为负，不能推导参考阈值");
  const unitCost = material != null && labor != null && quantity != null && quantity.gt(0) ? material.plus(labor).div(quantity) : null;
  if (unitCost != null && unitCost.lte(0)) defectReasons.push("预算材料及人工单位成本为零，不能换算参考阈值");
  const allowed = reserve != null && reserve.gte(0) && unitCost != null && unitCost.gt(0) ? reserve.div(unitCost) : null;
  const defectThreshold = allowed != null && quantity != null && quantity.gt(0) ? allowed.div(quantity.plus(allowed)) : null;
  if (defectThreshold == null && defectReasons.length === 0) defectReasons.push("参考阈值所需参数不完整");
  const defect = referenceItem({
    key: "defect",
    label: "产品不良率",
    formula: "允许补产量 = 损耗准备金 ÷（（预算材料 + 预算人工）÷ 合同数量）；参考阈值 = 允许补产量 ÷（合同数量 + 允许补产量）",
    unit: "比例",
    actual: actualDefect,
    threshold: defectThreshold,
    actualKnown: actualDefect != null,
    thresholdKnown: defectThreshold != null,
    reasons: defectReasons,
    basis: {
      reserve: amount(reserve),
      material: amount(material),
      labor: amount(labor),
      quantity: quantity == null ? null : quantity.toString(),
      unitCost: amount(unitCost, 6),
      allowedQuantity: amount(allowed, 6),
      processed: processed == null ? null : processed.toString(),
      defects: defects == null ? null : defects.toString()
    },
    source: "成本模型 · 含损耗预算基线中的生产损耗与不良损耗预算",
    applicability: "仅作预算模型参考，不是质量检验标准；材料、人工、收入或数量缺失、为零时不推导。",
    compare: (a, t) => a.gt(t)
  });
  const breaches = [margin, defect].filter((x2) => x2.breached).map((x2) => `${x2.label}${x2.key === "margin" ? "低于" : "高于"}参考阈值 ${x2.gapPp} 个百分点`);
  const unknownItems = [margin, defect].filter((x2) => x2.status === "unknown").map((x2) => ({
    key: x2.key,
    label: x2.label,
    actualKnown: x2.actualKnown,
    thresholdKnown: x2.thresholdKnown,
    reasons: x2.reasons
  }));
  const state = breaches.length ? "breach" : unknownItems.length === 2 ? "unknown" : unknownItems.length ? "partial" : "ok";
  return {
    state,
    breaches,
    unknownItems,
    margin,
    defect,
    baselineId: baselineId ?? null,
    asOf: asOf ?? null,
    ruleVersion: REFERENCE_RULE_VERSION,
    model: "预算模型参考阈值",
    source: "成本模型 · 含损耗预算基线",
    applicability: "仅作预算模型参考，不是企业质量检验标准或已核定的经营底线。",
    note: "毛利率与不良率分别判断；任一未知时不作肯定判断。"
  };
}
function buildSeverity(analysis = {}) {
  const actual = dec(analysis.cumulative?.actual?.margin);
  const expected = dec(analysis.cumulative?.expected?.margin);
  const reasons = [];
  if (actual == null) reasons.push("累计实际毛利率待补齐");
  if (expected == null) reasons.push("同进度理论毛利率待补齐");
  else if (expected.lte(0)) reasons.push("同进度理论毛利率为零或负，不能计算相对下降");
  const base = {
    actual: ratio(actual),
    expected: ratio(expected),
    decline: null,
    declinePct: null,
    declineAbsPct: null,
    differencePp: null,
    differenceAbsPp: null,
    thresholds: {
      normalMaxPct: new D(SEVERITY_THRESHOLDS.normalMax).times(100).toFixed(2),
      attentionMaxPct: new D(SEVERITY_THRESHOLDS.attentionMax).times(100).toFixed(2),
      keyMaxPct: new D(SEVERITY_THRESHOLDS.keyMax).times(100).toFixed(2)
    },
    ruleVersion: SEVERITY_RULE_VERSION,
    source: "累计实际毛利率 vs 同进度理论毛利率（当前对照基线）",
    note: "按相对下降分档：0–10% 可接受误差，10–20% 需关注，20–30% 重点注意，超过 30% 为大型偏差；该分级不是预算参考阈值越线判断。",
    reasons
  };
  if (reasons.length) return { ...base, level: "not_applicable", label: "待核算", tone: "pending" };
  const decline = expected.minus(actual).div(expected);
  const difference = actual.minus(expected);
  let level, label, tone;
  if (decline.lt(0)) {
    level = "better";
    label = "优于同进度理论";
    tone = "ok";
  } else if (decline.isZero()) {
    level = "normal";
    label = "与同进度理论持平";
    tone = "ok";
  } else if (decline.lte(SEVERITY_THRESHOLDS.normalMax)) {
    level = "normal";
    label = "可接受误差";
    tone = "ok";
  } else if (decline.lte(SEVERITY_THRESHOLDS.attentionMax)) {
    level = "attention";
    label = "需要关注";
    tone = "caution";
  } else if (decline.lte(SEVERITY_THRESHOLDS.keyMax)) {
    level = "key";
    label = "重点注意";
    tone = "caution";
  } else {
    level = "severe";
    label = "大型偏差";
    tone = "bad";
  }
  return {
    ...base,
    level,
    label,
    tone,
    decline: ratio(decline),
    declinePct: pp(decline),
    declineAbsPct: pp(decline.abs()),
    differencePp: pp(difference),
    differenceAbsPp: pp(difference.abs())
  };
}
function buildDiagnosis(analysis = {}) {
  const raw = analysis.bridge?.components ?? {};
  const total = dec(analysis.bridge?.total);
  const components = Object.entries(COMPONENTS).map(([key, meta]) => {
    const value = dec(raw[key]);
    const stated = classify(key, value);
    return {
      key,
      label: meta.label,
      kind: meta.kind,
      amount: amount(value),
      effect: stated.effect,
      fact: stated.fact,
      shareOfIncrease: null,
      evidence: meta.evidence
    };
  });
  const production = components.filter((c) => c.kind === "production");
  const increases = production.filter((c) => c.effect === "increase").sort((a, b) => Number(b.amount) - Number(a.amount));
  const offsets = production.filter((c) => c.effect === "offset").sort((a, b) => Number(a.amount) - Number(b.amount));
  const unknowns = components.filter((c) => c.effect === "unknown");
  const productionComplete = production.every((c) => c.amount != null);
  const closureComplete = components.every((c) => c.amount != null);
  const knownIncreasesTotal = increases.reduce((s, c) => s.plus(c.amount), new D(0));
  const knownOffsetsTotal = offsets.reduce((s, c) => s.plus(c.amount), new D(0));
  const increasesTotal = productionComplete ? knownIncreasesTotal : null;
  const offsetsTotal = productionComplete ? knownOffsetsTotal : null;
  if (productionComplete && knownIncreasesTotal.gt(0)) {
    for (const c of increases) c.shareOfIncrease = new D(c.amount).div(knownIncreasesTotal).toFixed(8);
  }
  const primary = productionComplete && increasesTotal != null && increasesTotal.gt(0) && increases.length && new D(increases[0].shareOfIncrease).gte(PRIMARY_SHARE_THRESHOLD) ? increases[0] : null;
  const baseline = components.find((c) => c.key === "budgetAdjustment");
  const rounding = components.find((c) => c.key === "rounding");
  const top = increases[0] ?? null;
  const missingLabels = unknowns.map((c) => c.label).join("、");
  let state, title, sub2;
  if (total == null) {
    state = "pending";
    title = "差距原因待补齐";
    sub2 = `总差距或关键资料缺失，暂不判断主因${missingLabels ? `；待补齐：${missingLabels}` : ""}。`;
  } else if (total.lte(0)) {
    state = "at_target";
    title = "当前没有少赚差距";
    sub2 = total.isZero() ? "实际生产毛利与同进度理论持平。" : `实际生产毛利高于同进度理论 ¥${total.abs().toFixed(2)}，未形成少赚。`;
    if (!closureComplete) sub2 += "部分归因资料待补齐，不影响已确认的总差距状态。";
  } else if (!productionComplete) {
    state = "gap";
    title = "差距已确认，部分归因待补齐";
    sub2 = `已确认少赚 ¥${total.toFixed(2)}；${missingLabels || "部分生产归因项"}资料不完整，暂不判断主因，也不计算完整占比。`;
  } else if (primary) {
    state = "gap";
    title = `差距主要体现在${primary.label}`;
    sub2 = `${primary.label}影响 ¥${new D(primary.amount).abs().toFixed(2)}，占增支 ${new D(primary.shareOfIncrease).times(100).toFixed(1)}%。`;
    if (offsetsTotal != null && offsetsTotal.lt(0)) sub2 += `另有抵消项 ¥${offsetsTotal.abs().toFixed(2)}。`;
  } else if (increasesTotal != null && increasesTotal.gt(0)) {
    state = "gap";
    title = "差距由多项成本共同造成";
    sub2 = `增支合计 ¥${increasesTotal.toFixed(2)}；最大项为${top.label} ¥${new D(top.amount).toFixed(2)}（占增支 ${new D(top.shareOfIncrease).times(100).toFixed(1)}%）。`;
    if (offsetsTotal != null && offsetsTotal.lt(0)) sub2 += `另有抵消项 ¥${offsetsTotal.abs().toFixed(2)}。`;
  } else {
    state = "gap";
    title = "差距主要来自预算调整";
    sub2 = "未发现生产成本增支项；差额来自预算允许损耗、舍入或其他调整，需结合基线口径核对。";
  }
  const suggestions = total != null && total.gt(0) ? increases.slice(0, 3).map((c) => ({
    key: c.key,
    label: c.label,
    amount: c.amount,
    shareOfIncrease: c.shareOfIncrease,
    text: COMPONENTS[c.key].suggestion,
    evidence: {
      asOf: analysis.asOf ?? null,
      revisionId: analysis.revisionId ?? null,
      baselineId: analysis.baselineId ?? null,
      source: COMPONENTS[c.key].evidence
    }
  })) : [];
  return {
    state,
    severity: buildSeverity(analysis),
    total: amount(total),
    attributionComplete: productionComplete,
    closureComplete,
    increases,
    offsets,
    unknowns,
    baseline,
    rounding,
    components,
    increasesTotal: amount(increasesTotal),
    offsetsTotal: amount(offsetsTotal),
    knownIncreasesTotal: amount(knownIncreasesTotal),
    knownOffsetsTotal: amount(knownOffsetsTotal),
    primary: primary ? { key: primary.key, label: primary.label, amount: primary.amount, shareOfIncrease: primary.shareOfIncrease } : null,
    summary: { title, sub: sub2 },
    suggestions,
    evidence: {
      asOf: analysis.asOf ?? null,
      revisionId: analysis.revisionId ?? null,
      baselineId: analysis.baselineId ?? null
    },
    rule: {
      version: DIAGNOSIS_RULE_VERSION,
      primaryShareThreshold: PRIMARY_SHARE_THRESHOLD,
      shareDenominator: "正向增支合计",
      shareLabel: "占增支",
      note: "主因仅在单一增支项占正向增支合计不低于60%时标识；否则按多项共同造成展示。该阈值是展示规则，不是企业已确认的风险标准。"
    }
  };
}

// server/import/validation.mjs
function decimal(value) {
  if (value === null || value === void 0 || String(value).trim() === "") return null;
  const s = String(value).trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) throw new Error("必须是数值");
  const d = new decimal_default(s);
  if (!d.isFinite() || d.abs().gt("1e15") || d.isNegative()) throw new Error("数值必须非负且不超过10^15");
  return d.toFixed();
}
function excelDate(value, epoch1904 = false, withTime = false) {
  if (value === null || value === void 0 || value === "") throw new Error("日期缺失");
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
    const s = String(value), m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|\+08:00)?)?$/);
    if (!m || Number(m[2] ?? 0) > 23 || Number(m[3] ?? 0) > 59 || Number(m[4] ?? 0) > 59) throw new Error("日期或时间无效；时区须为+08:00");
    const date2 = m[1];
    if ((/* @__PURE__ */ new Date(date2 + "T00:00:00Z")).toISOString().slice(0, 10) !== date2) throw new Error("日期无效");
    if (withTime && m[5] === "Z") return new Date(Date.parse(s) + 8 * 36e5).toISOString().slice(0, 19) + "+08:00";
    return withTime ? `${date2}T${m[2] ?? "00"}:${m[3] ?? "00"}:${m[4] ?? "00"}+08:00` : date2;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 2958465 || !epoch1904 && Math.floor(n) === 60) throw new Error("Excel日期无效");
  const epoch = epoch1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, n < 60 ? 31 : 30);
  const ms = epoch + Math.round(n * 86400) * 1e3;
  const iso = new Date(ms).toISOString();
  return withTime ? iso.slice(0, 19) + "+08:00" : iso.slice(0, 10);
}
function columnIndex(c) {
  let n = 0;
  for (const x2 of c) n = n * 26 + x2.charCodeAt(0) - 64;
  return n;
}
function addDays(date2, n) {
  const d = /* @__PURE__ */ new Date(date2 + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// server/model.mjs
var CATEGORIES = ["人工", "制造", "其他生产", "管理", "销售", "财务"];
var STATUSES = ["已确认", "暂估", "缺失", "不适用", "模拟确认"];
var SCHEMA_VERSION = "IMPORT-0.2";

// server/profit/evaluate.mjs
var amountSum = (xs) => money(sum2(xs));
function evaluate(dataset, { asOf, baselineMode = "ideal", knownAt } = {}) {
  const { order: o, baseline: b } = dataset;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf ?? "") || Number.isNaN(Date.parse(asOf)) || new Date(asOf).toISOString().slice(0, 10) !== asOf) throw new Error("请选择有效日期");
  if (!["ideal", "budget"].includes(baselineMode)) throw new Error("理论基线模式无效");
  if (knownAt !== void 0 && (typeof knownAt !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(knownAt) || !Number.isFinite(Date.parse(knownAt)))) throw new Error("信息截止时间无效");
  const base = prepareBaseline(dataset), missing = [], cutoff = knownAt ?? asOf + "T23:59:59+08:00";
  const cutoffMs = Date.parse(cutoff);
  const visible = (r) => r.availableAt && Date.parse(r.availableAt) <= cutoffMs;
  const miss = (date2, field, detail) => {
    if (missing.length < 1e3) missing.push({ date: date2, field, detail });
  };
  for (const k of ["quantity", "price", "weight", "opening"]) if (o[k] == null) miss(null, "order", `订单${k}待补齐`);
  for (const [k, v] of Object.entries(b.params)) if (v == null) miss(null, "baseline", `基线参数${k}待补齐`);
  for (const r of b.recipe) if (r.quantity == null || r.referencePrice == null) miss(null, "baseline", `${r.id}配方量或参考价格待补齐`);
  const sizePlanComplete = b.sizePlan.length > 0 && b.sizePlan.every((s) => s.quantity != null);
  if (!sizePlanComplete) miss(null, "production", "分码合同量待补齐");
  const activeSizes = b.sizePlan.filter((s) => s.quantity != null && new D(s.quantity).gt(0));
  const days = [];
  for (let date2 = o.start; date2 <= o.end && date2 <= asOf; date2 = addDays(date2, 1)) {
    const allProduction = dataset.production.filter((r) => r.date === date2);
    const productions = allProduction.filter(visible);
    const complete = sizePlanComplete && activeSizes.length > 0 && productions.every((r) => valid(r) && r.dayStatus !== "待补录" && r.processed != null && r.defects != null) && activeSizes.every((s) => {
      const rs = productions.filter((r) => r.size === s.id);
      return rs.length === 1 && valid(rs[0]) && rs[0].processed !== null && rs[0].defects !== null;
    });
    if (!complete) miss(date2, "production", "日码数量缺失、待确认或尚不可见");
    const processed = complete ? productions.reduce((s, r) => s + Number(r.processed), 0) : null, defects = complete ? productions.reduce((s, r) => s + Number(r.defects), 0) : null, quantity = complete ? processed - defects : null;
    const revenue = quantity !== null && o.price !== null ? money(new D(quantity).times(o.price)) : null;
    const allMaterials = dataset.materials.filter((r) => r.date === date2), materials = allMaterials.filter(visible);
    let materialCost = new D(0), priceImpact = new D(0), usageImpact = new D(0), materialComplete = true;
    for (const m of base.materials) {
      const all = allMaterials.filter((r) => r.materialId === m.id), rs = materials.filter((r) => r.materialId === m.id);
      if (!rs.length || rs.length !== all.length || rs.some((r) => !valid(r) || r.net === null || r.price === null)) {
        materialComplete = false;
        miss(date2, "material", `${m.id}净耗、单价或可见时间待补齐`);
        continue;
      }
      materialCost = materialCost.plus(sum2(rs.map((r) => money(six(r.net).times(six(r.price))))));
      if (quantity !== null && m.price !== null) {
        const actualNet = sum2(rs.map((r) => six(r.net)));
        const standard = six(new D(quantity).times(o.weight).times(m.share));
        priceImpact = priceImpact.plus(sum2(rs.map((r) => money(six(r.net).times(six(r.price).minus(m.price))))));
        usageImpact = usageImpact.plus(money(actualNet.minus(standard).times(m.price)));
      }
    }
    const allExpenses = dataset.expenses.filter((r) => r.date === date2), expenses = allExpenses.filter(visible), costs = {};
    for (const cat of CATEGORIES) {
      const all = allExpenses.filter((r) => r.category === cat), rs = expenses.filter((r) => r.category === cat);
      const good = rs.length > 0 && all.length === rs.length && rs.every((r) => valid(r) && r.amount !== null);
      costs[cat] = good ? amountSum(rs.map((r) => money(r.amount))) : null;
      if (!good) miss(date2, cat, "费用未完整归属、尚不可见或待补齐");
    }
    const actualCost = materialComplete ? sum2([money(materialCost), costs.人工, costs.制造, costs.其他生产]) : null;
    const gross = revenue !== null && actualCost !== null ? money(new D(revenue).minus(actualCost)) : null;
    const operatingCost = sum2([costs.管理, costs.销售, costs.财务]);
    const operating = gross !== null && operatingCost !== null ? money(new D(gross).minus(operatingCost)) : null;
    const expected = base.theoretical(quantity, baselineMode), gap = expected.gross !== null && gross !== null ? money(new D(expected.gross).minus(gross)) : null;
    const diff = (a, e) => a !== null && e !== null ? money(new D(a).minus(e)) : null;
    const energyRows = expenses.filter((r) => r.category === "制造" && /能源/.test(r.item));
    const energyActual = costs.制造 === null ? null : amountSum(energyRows.map((r) => r.amount));
    const energyDiff = diff(energyActual, expected.energy);
    const otherManufacturing = costs.制造 !== null && expected.productionManagement !== null && energyActual !== null ? money(new D(costs.制造).minus(energyActual).minus(expected.productionManagement)) : null;
    const components2 = { materialPrice: materialComplete && matsReady(base) && quantity !== null ? money(priceImpact) : null, materialUsage: materialComplete && matsReady(base) && quantity !== null ? money(usageImpact) : null, labor: diff(costs.人工, expected.labor), energy: energyDiff, otherManufacturing, otherProduction: diff(costs.其他生产, expected.otherProduction), budgetAdjustment: expected.reserve === null ? null : money(new D(expected.reserve).negated()) };
    components2.rounding = gap !== null && Object.values(components2).every((v) => v !== null) ? money(new D(gap).minus(sum2(Object.values(components2)))) : null;
    days.push({ date: date2, quantity, processed, defects, revenue, actual: { material: materialComplete ? money(materialCost) : null, costs, productionCost: money(actualCost), gross, operating, margin: gross !== null && Number(revenue) > 0 ? new D(gross).div(revenue).toFixed(8) : null }, expected, gap, delta: gap === null ? null : money(new D(gap).negated()), components: components2, rows: { production: productions, materials, expenses, supplements: dataset.supplements.filter((s) => s.date === date2 && visible(s)) } });
  }
  const aggregate = (field, side) => amountSum(days.map((d) => side ? d[side][field] : d[field]));
  const totalQuantity = days.some((d) => d.quantity === null) || o.opening === null ? null : days.reduce((s, d) => s + d.quantity, 0);
  const dailySum = (fn) => amountSum(days.map(fn));
  const cumulative = { quantity: totalQuantity, processed: days.some((d) => d.processed === null) ? null : days.reduce((s, d) => s + d.processed, 0), defects: days.some((d) => d.defects === null) ? null : days.reduce((s, d) => s + d.defects, 0), revenue: aggregate("revenue"), actual: { gross: aggregate("gross", "actual"), operating: aggregate("operating", "actual") }, expected: { gross: aggregate("gross", "expected"), operating: aggregate("operating", "expected") }, gap: aggregate("gap"), delta: aggregate("delta") };
  cumulative.actual.material = dailySum((d) => d.actual.material);
  cumulative.actual.costs = Object.fromEntries(CATEGORIES.map((c) => [c, dailySum((d) => d.actual.costs[c])]));
  for (const k of ["material", "labor", "manufacturing", "otherProduction", "reserve", "operatingCosts"]) cumulative.expected[k] = dailySum((d) => d.expected[k]);
  cumulative.actual.margin = cumulative.actual.gross !== null && Number(cumulative.revenue) > 0 ? new D(cumulative.actual.gross).div(cumulative.revenue).toFixed(8) : null;
  cumulative.expected.margin = cumulative.expected.gross !== null && Number(cumulative.revenue) > 0 ? new D(cumulative.expected.gross).div(cumulative.revenue).toFixed(8) : null;
  cumulative.progress = totalQuantity !== null && Number(o.quantity) > 0 ? new D(totalQuantity).div(o.quantity).toFixed(8) : null;
  cumulative.remaining = totalQuantity === null ? null : Math.max(0, Number(o.quantity) - totalQuantity);
  cumulative.overproduction = totalQuantity === null ? null : Math.max(0, totalQuantity - Number(o.quantity));
  const components = Object.fromEntries(["materialPrice", "materialUsage", "labor", "energy", "otherManufacturing", "otherProduction", "budgetAdjustment", "rounding"].map((k) => [k, amountSum(days.map((d) => d.components[k]))]));
  const state = asOf < o.start ? "not_started" : missing.some((m) => ["order", "baseline", "production", "material", "人工", "制造", "其他生产"].includes(m.field)) ? "incomplete" : dataset.production.concat(dataset.materials, dataset.expenses).some((r) => r.date <= asOf && visible(r) && r.status === "暂估") ? "provisional" : missing.length ? "operating_incomplete" : "complete";
  const visibleSupplements = dataset.supplements.filter((r) => r.date <= asOf && visible(r));
  const visibilityEnd = dataset.production.concat(dataset.materials, dataset.expenses, dataset.supplements).reduce((end, r) => r.availableAt?.slice(0, 10) > end ? r.availableAt.slice(0, 10) : end, o.end);
  const sameQuantityTheory = base.theoretical(totalQuantity, baselineMode);
  cumulative.expected.revenue = sameQuantityTheory.revenue;
  const theoreticalRounding = sameQuantityTheory.gross !== null && cumulative.expected.gross !== null ? money(new D(sameQuantityTheory.gross).minus(cumulative.expected.gross)) : null;
  const dimension = (items) => ({ state: items.length ? "incomplete" : "complete", missing: items });
  const completeness = {
    actual: dimension(missing.filter((m) => m.field !== "baseline" && m.field !== "production")),
    baseline: dimension(missing.filter((m) => m.field === "baseline")),
    progress: dimension(missing.filter((m) => m.field === "production" || m.field === "order"))
  };
  const profitScope = { grossProfit: cumulative.actual.gross, managementProfit: cumulative.actual.operating, forecastProfit: null, finalProfit: null, settlement: { state: "open", reason: "导入首版不包含正式结算资料；最终利润待结算后提供" } };
  const daySummaries = days.map((d) => ({ date: d.date, quantity: d.quantity, revenue: d.revenue, actual: { material: d.actual.material, costs: d.actual.costs, gross: d.actual.gross, operating: d.actual.operating }, expected: { gross: d.expected.gross, revenue: d.expected.revenue }, gap: d.gap, components: d.components }));
  const result = { knownAt: knownAt ?? null, visibilityEnd, theoreticalRounding, order: o, revisionId: dataset.revision.id, baselineId: b.id, baselineMode, asOf, daily: days.find((d) => d.date === asOf) ?? null, daySummaries, cumulative, theoreticalTotal: base.theoretical(o.quantity, baselineMode), bridge: { total: cumulative.gap, components }, profitScope, quality: { state, missing, completeness, isDemo: o.isDemo }, evidence: days.flatMap((d) => [...d.rows.production, ...d.rows.materials, ...d.rows.expenses].map((r) => r.source)), warnings: visibleSupplements.length ? [`补单为已含记录，不额外增加产量和成本；不良与补单差异${dataset.production.filter((r) => r.date <= asOf && visible(r)).reduce((s, r) => s + Number(r.defects ?? 0), 0) - visibleSupplements.reduce((s, r) => s + Number(r.quantity ?? 0), 0)}双`] : [] };
  result.referenceThresholds = buildReferenceThresholds({ order: o, cumulative, theoreticalBudget: base.theoretical(o.quantity, "budget"), baselineId: b.id, asOf });
  result.diagnosis = buildDiagnosis(result);
  return result;
}
function matsReady(base) {
  return base.materials.every((m) => m.price !== null);
}

// server/storage/store.mjs
import { mkdir as mkdir2, readdir, readFile as readFile2, writeFile as writeFile2, rename as rename2, unlink as unlink2 } from "node:fs/promises";
import { createHash as createHash2, randomUUID as randomUUID3 } from "node:crypto";
import path2 from "node:path";
function stable(v) {
  if (Array.isArray(v)) {
    const a = v.map(stable);
    return a.every((x2) => x2 && typeof x2 === "object" && "id" in x2) ? a.sort((x2, y) => String(x2.id).localeCompare(String(y.id))) : a;
  }
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).filter((k) => !["source", "sourceFiles"].includes(k)).sort().map((k) => [k, stable(v[k])]));
  return v;
}
var digest = (v) => createHash2("sha256").update(JSON.stringify(stable(v))).digest("hex");
var conflict = (message) => Object.assign(new Error(message), { status: 409 });
function createStore(directory) {
  let queue = Promise.resolve();
  const readAll = async () => {
    await mkdir2(directory, { recursive: true });
    const result = [];
    for (const name of (await readdir(directory)).filter((n) => /^[a-f0-9]{64}\.json$/.test(n))) {
      let v;
      try {
        v = JSON.parse(await readFile2(path2.join(directory, name), "utf8"));
      } catch {
        throw new Error("本地导入数据损坏，请从备份恢复");
      }
      if (!v.dataset?.order?.id || !v.dataset?.revision?.id) throw new Error("本地导入版本无效");
      result.push(v);
    }
    return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  };
  const listRevisions = async (id) => (await readAll()).filter((x2) => x2.dataset.order.id === id).reverse().map((x2) => ({ revisionId: x2.dataset.revision.id, baselineId: x2.dataset.baseline.id, createdAt: x2.createdAt, hash: x2.hash }));
  const get = async (id, revision) => {
    const versions = (await readAll()).filter((x2) => x2.dataset.order.id === id && (!revision || x2.dataset.revision.id === revision));
    if (!versions.length) throw Object.assign(new Error("未找到订单或数据版本"), { status: 404 });
    return versions.at(-1).dataset;
  };
  const listOrders = async () => {
    const latest = /* @__PURE__ */ new Map();
    for (const v of await readAll()) {
      const d = v.dataset;
      latest.set(d.order.id, { ...d.order, revisionId: d.revision.id, baselineId: d.baseline.id, createdAt: v.createdAt, counts: { production: d.production.length, supplements: d.supplements.length, materials: d.materials.length, expenses: d.expenses.length } });
    }
    return [...latest.values()];
  };
  const commit = (dataset) => {
    const job = queue.then(async () => {
      const all = await readAll(), hash2 = digest(dataset), baseHash = digest(dataset.baseline), same = all.find((v) => v.dataset.order.id === dataset.order.id && v.dataset.revision.id === dataset.revision.id);
      if (same) {
        if (same.hash !== hash2) throw conflict("同一修订号内容已改变，请使用新修订版本");
        return { orderId: dataset.order.id, revisionId: dataset.revision.id, reused: true };
      }
      for (const v of all.filter((v2) => v2.dataset.order.id === dataset.order.id)) {
        if (v.dataset.order.lineId !== dataset.order.lineId) throw conflict("首版同订单只支持一个核算子项，请使用独立订单标识");
        if (v.dataset.baseline.id === dataset.baseline.id && (digest(v.dataset.baseline) !== baseHash || ["quantity", "price", "weight"].some((k) => v.dataset.order[k] !== dataset.order[k]))) throw conflict("冻结基线内容已改变，请使用新基线版本");
      }
      const key = createHash2("sha256").update(dataset.order.id + "\0" + dataset.revision.id).digest("hex"), target = path2.join(directory, key + ".json"), tmp = path2.join(directory, key + "." + randomUUID3() + ".tmp");
      const timestamp2 = Math.max(Date.now(), all.length ? Date.parse(all.at(-1).createdAt) + 1 : 0);
      try {
        await writeFile2(tmp, JSON.stringify({ hash: hash2, createdAt: new Date(timestamp2).toISOString(), dataset }), { flag: "wx" });
        await rename2(tmp, target);
      } catch (e) {
        await unlink2(tmp).catch(() => {
        });
        throw e;
      }
      return { orderId: dataset.order.id, revisionId: dataset.revision.id, reused: false };
    });
    queue = job.catch(() => {
    });
    return job;
  };
  return { listOrders, listRevisions, get, commit, listVersions: readAll };
}

// server/profit/contract-adapter.mjs
var FORMULA_VERSION = "IMPORT-FORMULA-0.2";
var RULE_VERSION = "IMPORT-RULES-0.2";
var ratio2 = (x2) => x2 == null ? null : new D(x2).toFixed(6);
var mapQuality = (state) => ({ complete: "complete", provisional: "estimated", not_started: "incomplete", incomplete: "incomplete", operating_incomplete: "incomplete" })[state] ?? "incomplete";
var unitProfit = (gross, quantity) => gross === null || quantity === null || Number(quantity) <= 0 ? null : new D(gross).div(quantity).toFixed(6);
var metrics = (c, side, quality) => {
  const x2 = c[side], revenue = side === "actual" ? c.revenue : c.expected.revenue;
  return { revenue: revenue ?? null, material_cost: x2.material ?? null, labor_cost: side === "actual" ? x2.costs?.人工 ?? null : x2.labor ?? null, manufacturing_cost: side === "actual" ? x2.costs?.制造 ?? null : x2.manufacturing ?? null, other_production_cost: side === "actual" ? x2.costs?.其他生产 ?? null : x2.otherProduction ?? null, total_production_cost: revenue != null && x2.gross != null ? money(new D(revenue).minus(x2.gross)) : null, gross_profit: x2.gross ?? null, unit_gross_profit: unitProfit(x2.gross ?? null, c.quantity), gross_margin: ratio2(x2.margin), management_profit: x2.operating ?? null, forecast_profit: null, final_profit: null, quality };
};
var variance = (category, expected, actual) => ({ category, expected: expected ?? null, actual: actual ?? null, delta: expected != null && actual != null ? money(new D(actual).minus(expected)) : null, evidence_ids: [] });
function toCalculationResult(evaluation, { dataset, snapshotId, computedAt } = {}) {
  if (!dataset) throw new Error("契约适配需要原始数据集");
  const { cumulative: c, order: o, quality } = evaluation, mapped = mapQuality(quality.state), comparable = c.actual.gross !== null && c.expected.gross !== null;
  const profitDelta = comparable ? c.delta : null;
  const marginDelta = comparable && c.actual.margin != null && c.expected.margin != null ? ratio2(new D(c.actual.margin).minus(c.expected.margin)) : null;
  const relativeDecline = comparable && c.expected.margin != null && new D(c.expected.margin).gt(0) ? ratio2(new D(c.expected.margin).minus(c.actual.margin).div(c.expected.margin)) : null;
  const hash2 = digest(dataset), costVariances = [variance("material", c.expected.material, c.actual.material), variance("labor", c.expected.labor, c.actual.costs?.人工), variance("manufacturing", c.expected.manufacturing, c.actual.costs?.制造), variance("other_production", c.expected.otherProduction, c.actual.costs?.其他生产)];
  const issues = [...quality.missing.map((m) => ({ code: "IMPORT_MISSING", message: m.detail, field: m.field ?? "", severity: "blocking", source_refs: [] })), ...(evaluation.warnings ?? []).map((message) => ({ code: "IMPORT_WARNING", message, field: "", severity: "warning", source_refs: [] }))];
  return {
    snapshot_id: snapshotId ?? `local-${hash2.slice(0, 16)}-${evaluation.asOf}-${evaluation.baselineMode}`,
    order_id: o.id,
    baseline_id: evaluation.baselineId ?? null,
    input_hash: hash2,
    formula_version: FORMULA_VERSION,
    rule_version: RULE_VERSION,
    computed_at: computedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    scope: { basis: "cumulative", period_start: o.start, period_end: evaluation.asOf, quantity_basis: "completed_good", quantity: c.quantity == null ? null : String(c.quantity), quantity_unit: "双", currency: "CNY", tax_basis: "ignored", cost_scope_id: evaluation.baselineId ?? "IMPORT-0.2", revenue_basis: "production_equivalent", settlement_state: "open" },
    expected: metrics(c, "expected", mapped),
    actual: metrics(c, "actual", mapped),
    comparison: { comparable, quality: mapped, reasons: quality.missing.slice(0, 10).map((m) => m.detail).concat(comparable ? [] : ["实际或同进度理论毛利缺失，暂不可比"]), profit_delta: profitDelta, revenue_delta: comparable ? "0.00" : null, margin_delta: marginDelta, relative_decline: relativeDecline, risk: { level: "not_applicable", rule_version: RULE_VERSION, reason: "导入适配层未接入风险分级；差距与质量状态以导入核算结果为准", loss: c.actual.gross !== null && new D(c.actual.gross).lt(0) }, cost_variances: costVariances },
    issues,
    evidence: []
  };
}

// server/monitor/recommendations.mjs
var positive = (x2, y) => x2 != null && y != null && new D(x2).gt(y);
var unit = (x2, q) => x2 != null && q > 0 ? new D(x2).div(q) : null;
function recommendations({ today, previous, comparison, orderId, revisionId, baselineMode, asOf, snapshotId }) {
  const result = [];
  const add2 = (ruleId, change, advice, rows, impact = null) => {
    result.push({ ruleId, change, advice, unitCostImpact: impact?.toString() ?? null, evidence: rows.map((r) => ({ evidenceId: `${snapshotId}:${r.id}`, snapshotId, orderId, businessDate: r.date, revisionId, baselineMode, category: r.category ?? null, materialId: r.materialId ?? null, recordId: r.id, source: r.source ?? null })), comparisonStatus: comparison.status });
  };
  if (comparison.status !== "comparable") {
    add2("DATA_CHECK", comparison.reasons.join("；"), "先核对缺项、录入时间及版本；资料更新不能直接解释为经营恶化。", [...today?.rows.production ?? [], ...today?.rows.expenses ?? []]);
    return result;
  }
  const tq = today.quantity, pq = previous.quantity;
  const materialIds = [...new Set(today.rows.materials.map((r) => r.materialId))];
  for (const id of materialIds) {
    const now = today.rows.materials.filter((r) => r.materialId === id), before = previous.rows.materials.filter((r) => r.materialId === id);
    if (!before.length || [...now, ...before].some((r) => r.net == null || r.price == null)) continue;
    const net = (rs) => rs.reduce((s, r) => s.plus(r.net), new D(0)), cost = (rs) => rs.reduce((s, r) => s.plus(new D(r.net).times(r.price)), new D(0));
    const n = net(now), b = net(before), price = n.gt(0) ? cost(now).div(n) : null, oldPrice = b.gt(0) ? cost(before).div(b) : null;
    if (positive(price, oldPrice) && positive(unit(today.components.materialPrice, tq), unit(previous.components.materialPrice, pq))) add2("MATERIAL_PRICE", `材料 ${id} 加权单价 ${oldPrice.toFixed(6)} → ${price.toFixed(6)} 元/kg`, "核对采购批次、供应商报价、入库单价和录入值。", [...before, ...now], price.minus(oldPrice).times(n).div(tq));
    if (positive(unit(n, tq), unit(b, pq))) add2("MATERIAL_USAGE", `材料 ${id} 单位合格品净耗 ${unit(b, pq).toFixed(6)} → ${unit(n, tq).toFixed(6)} kg/双`, "核对领退料、标准重量、不良数量及净耗口径；耗用增加原因待核实。", [...before, ...now], unit(n, tq).minus(unit(b, pq)).times(oldPrice ?? 0));
  }
  for (const [category, ruleId, advice] of [["人工", "LABOR", "核对工价、计件量、合格产量与费用归属。"], ["制造", "MANUFACTURING", "核对费用所属日期、订单及分摊依据；现有资料不足以认定停机低效。"]]) {
    const now = unit(today.actual.costs[category], tq), before = unit(previous.actual.costs[category], pq);
    if (positive(now, before)) add2(ruleId, `单位合格品${category}费用 ${money(before)} → ${money(now)} 元/双`, advice, [...previous.rows.expenses, ...today.rows.expenses].filter((r) => r.category === category), now.minus(before));
  }
  const supplements = today.rows.supplements ?? [], prior = previous.rows.supplements ?? [];
  const qty = (rs) => rs.reduce((s, r) => r.quantity == null ? s : s.plus(r.quantity), new D(0));
  if (supplements.length && positive(unit(qty(supplements), tq), unit(qty(prior), pq))) add2("SUPPLEMENT_LINK", "补单数量占合格产量的比例增加", "核对补料/补产用途及关联；已含加工量和净耗的补单不重复扣成本。", supplements);
  const grouped = /* @__PURE__ */ new Map();
  for (const item of result) {
    const old = grouped.get(item.ruleId);
    if (!old) {
      grouped.set(item.ruleId, item);
      continue;
    }
    old.change += "；" + item.change;
    old.evidence.push(...item.evidence);
    old.unitCostImpact = old.unitCostImpact == null || item.unitCostImpact == null ? null : new D(old.unitCostImpact).plus(item.unitCostImpact).toString();
  }
  return [...grouped.values()].sort((a, b) => a.unitCostImpact == null ? b.unitCostImpact == null ? 0 : 1 : b.unitCostImpact == null ? -1 : new D(b.unitCostImpact).cmp(a.unitCostImpact)).slice(0, 3);
}

// server/profit/monitor-risk.mjs
var MONITOR_RISK_VERSION = "RELATIVE-MARGIN-1";
var priorities = { "严重": 0, "重点": 1, "注意": 2, "数据不足": 3, "缺少基线": 4, "不可评级": 5, "正常": 6, "优于预期": 7 };
function classifyMonitorRisk({ actual, expected, revenue, baselineComplete = true }) {
  let label, reason, relativeDecline = null;
  if (actual == null || revenue == null || !new D(revenue).gt(0)) {
    label = "数据不足";
    reason = "实际生产毛利或正收入尚不完整";
  } else if (expected == null || !baselineComplete) {
    label = "缺少基线";
    reason = "同进度理论基线不完整";
  } else if (!new D(expected).gt(0)) {
    label = "不可评级";
    reason = "预期毛利率非正，不适用相对下降分级";
  } else {
    const decline = new D(expected).minus(actual).div(expected);
    relativeDecline = decline.toString();
    label = decline.lt(0) ? "优于预期" : decline.lte(".1") ? "正常" : decline.lte(".2") ? "注意" : decline.lte(".3") ? "重点" : "严重";
    reason = "同进度毛利率相对下降：≤10%正常，≤20%注意，≤30%重点，超过30%严重";
  }
  return { label, priority: priorities[label], reason, relativeDecline, ruleVersion: MONITOR_RISK_VERSION };
}

// server/monitor/overview.mjs
function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "") || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw fail("INVALID_REQUEST", "业务日期无效");
  return value;
}
var shift = (day, n) => new Date(Date.parse(day + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
function timestamp(v) {
  if (typeof v !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(v) || !Number.isFinite(Date.parse(v))) throw fail("INVALID_REQUEST", "信息截止时间需要包含时区");
  return new Date(v).toISOString();
}
var sum3 = (rows, fn) => rows.length ? money(rows.reduce((s, r) => s.plus(fn(r)), new D(0))) : null;
var distributionKey = (day) => {
  const margin = day?.actual.gross != null && day?.revenue != null && new D(day.revenue).gt(0) ? new D(day.actual.gross).div(day.revenue) : day?.actual.margin;
  return margin == null ? "unknown" : new D(margin).gte(".3") ? "high" : new D(margin).gte(".1") ? "medium" : new D(margin).gte(0) ? "low" : "negative";
};
function compare(dataset, today, previous, asOf) {
  const reasons = [];
  if (!today || !previous) reasons.push("缺少当日或昨日明确报工");
  for (const d of [previous, today]) if (d) {
    if (d.revenue == null || !new D(d.revenue).gt(0)) reasons.push(`${d.date} 收入为零或未知`);
    if (d.actual.productionCost == null || d.actual.margin == null) reasons.push(`${d.date} 生产成本或毛利率不完整`);
    if (!(d.quantity > 0)) reasons.push(`${d.date} 合格量为零或未知`);
  }
  const affected = [...dataset.production, ...dataset.materials, ...dataset.expenses, ...dataset.supplements].filter((r) => [asOf, shift(asOf, -1)].includes(r.date));
  if (affected.some((r) => r.availableAt && Date.parse(r.availableAt) > Date.parse(r.date + "T23:59:59.999+08:00"))) reasons.push("存在迟录资料，资料更新待核查");
  if (dataset._revisionCount > 1) reasons.push("整套导入修订发生变化，无法可靠区分经营变化与资料修订");
  if (reasons.length) return { status: "unavailable", reasons: [...new Set(reasons)], marginChangePp: null, unitCost: null, previousUnitCost: null, unitCostChange: null, deteriorated: false };
  const change = new D(today.actual.gross).div(today.revenue).minus(new D(previous.actual.gross).div(previous.revenue)).times(100), now = new D(today.actual.productionCost).div(today.quantity), before = new D(previous.actual.productionCost).div(previous.quantity);
  return { status: "comparable", reasons: [], marginChangePp: change.toString(), unitCost: now.toFixed(6), previousUnitCost: before.toFixed(6), unitCostChange: now.minus(before).toFixed(6), deteriorated: change.lt(0) };
}
async function buildOverview(entries, { asOf, period = 7, baselineMode = "ideal", knownAt, viewId = randomUUID4(), compute = evaluate, customer = "", status = "", risk = "", search = "" } = {}) {
  date(asOf);
  knownAt = timestamp(knownAt ?? (/* @__PURE__ */ new Date()).toISOString());
  if (!["ideal", "budget"].includes(baselineMode) || !Number.isInteger(period) || period < 1 || period > 90) throw fail("INVALID_REQUEST", "理论模式或趋势窗口无效（1–90 天）");
  const requestedStart = shift(asOf, 1 - period), firstStart = entries.map((e) => e.dataset.order.start).sort()[0], start = firstStart && firstStart <= asOf && firstStart > requestedStart ? firstStart : requestedStart, snapshots = [], orders = [];
  for (const entry of entries) {
    const dataset = entry.dataset, visible = dataset, evaluation = compute(visible, { asOf, baselineMode, knownAt }), snapshotId = randomUUID4();
    const previous = evaluation.days?.find((d) => d.date === shift(asOf, -1)) ?? compute(visible, { asOf: shift(asOf, -1), baselineMode, knownAt }).daily;
    const comparison = compare({ ...dataset, _revisionCount: entry.revisionCount }, evaluation.daily, previous, asOf);
    const contract = toCalculationResult(evaluation, { dataset, snapshotId, computedAt: (/* @__PURE__ */ new Date()).toISOString() });
    const cumulative = evaluation.cumulative, eligible = asOf >= dataset.order.start && cumulative.actual.gross != null && cumulative.expected.gross != null;
    const monitoringStatus = asOf < dataset.order.start ? "未开工" : cumulative.quantity == null ? "待确认" : dataset.order.quantity != null && new D(cumulative.quantity).gte(dataset.order.quantity) ? "已完工" : "生产中";
    const riskInfo = classifyMonitorRisk({ actual: cumulative.actual.gross, expected: cumulative.expected.gross, revenue: cumulative.revenue, baselineComplete: evaluation.quality.completeness?.baseline.state === "complete" });
    const marginDeviationPp = eligible && cumulative.revenue != null && new D(cumulative.revenue).gt(0) ? new D(cumulative.actual.gross).minus(cumulative.expected.gross).div(cumulative.revenue).times(100).toString() : null;
    const points = [];
    for (let d = start; d <= asOf; d = shift(d, 1)) {
      const a = d === asOf ? evaluation : compute(visible, { asOf: d, baselineMode, knownAt });
      points.push({ date: d, actual: a.cumulative.actual.gross, expected: a.cumulative.expected.gross, comparable: a.cumulative.actual.gross != null && a.cumulative.expected.gross != null && d >= dataset.order.start });
    }
    const row = { order: dataset.order, revisionId: dataset.revision.id, baselineId: dataset.baseline.id, snapshotId, cumulative, daily: evaluation.daily, comparison, quality: evaluation.quality, comparable: eligible, distribution: asOf < dataset.order.start ? "not_started" : distributionKey(evaluation.daily), points, loss: cumulative.actual.gross != null && new D(cumulative.actual.gross).lt(0), cumulativeDeviation: eligible && new D(cumulative.gap).gt(0), recommendations: recommendations({ today: evaluation.daily, previous, comparison, orderId: dataset.order.id, revisionId: dataset.revision.id, baselineMode, asOf, snapshotId }) };
    row.evidence = [...evaluation.evidence.map((source, i2) => ({ evidenceId: `${snapshotId}:source-${i2}`, source })), ...row.recommendations.flatMap((r) => r.evidence)];
    Object.assign(row, { monitoringStatus, risk: riskInfo, marginDeviationPp });
    snapshots.push({ snapshot_id: snapshotId, order_id: dataset.order.id, as_of: asOf, known_at: knownAt, revision_id: dataset.revision.id, baseline_mode: baselineMode, input_hash: hash(dataset), result: contract, evaluation: { daily: evaluation.daily }, previous, recorded_at: (/* @__PURE__ */ new Date()).toISOString(), evidence: row.evidence });
    orders.push(row);
  }
  const filterOptions = { customers: [...new Set(orders.map((r) => r.order.customer).filter(Boolean))].sort(), statuses: ["生产中", "已完工", "未开工", "待确认"], risks: ["严重", "重点", "注意", "数据不足", "缺少基线", "不可评级", "正常", "优于预期"] };
  if (status && !filterOptions.statuses.includes(status) || risk && !filterOptions.risks.includes(risk) || search.length > 200) throw fail("INVALID_REQUEST", "筛选条件无效");
  orders.splice(0, orders.length, ...orders.filter((r) => (!customer || r.order.customer === customer) && (!status || r.monitoringStatus === status) && (!risk || r.risk.label === risk) && (!search || [r.order.id, r.order.product, r.order.customer].join(" ").toLowerCase().includes(search.toLowerCase()))));
  const firstFiltered = orders.map((r) => r.order.start).sort()[0], displayStart = firstFiltered && firstFiltered <= asOf && firstFiltered > start ? firstFiltered : start;
  for (const row of orders) row.points = row.points.filter((p) => p.date >= displayStart);
  const filteredPointCount = Math.round((Date.parse(asOf) - Date.parse(displayStart)) / 864e5) + 1;
  orders.sort((a, b) => {
    const x2 = a.comparison.marginChangePp, y = b.comparison.marginChangePp;
    return x2 == null ? y == null ? a.order.id.localeCompare(b.order.id) : 1 : y == null ? -1 : new D(x2).cmp(y) || a.order.id.localeCompare(b.order.id);
  });
  const comparable = orders.filter((r) => r.comparable), intersection = orders.filter((r) => r.points.every((p) => p.comparable));
  const trend2 = Array.from({ length: filteredPointCount }, (_, i2) => {
    const day = shift(displayStart, i2), rows = intersection.map((r) => r.points[i2]);
    return { date: day, actual: sum3(rows, (r) => r.actual), expected: sum3(rows, (r) => r.expected), includedCount: rows.length, excludedCount: orders.length - rows.length };
  });
  const buckets = [["high", "≥30%"], ["medium", "10%–不足30%"], ["low", "0%–不足10%"], ["negative", "<0%"], ["unknown", "无法计算"], ["not_started", "未开工"]].map(([key, label]) => ({ key, label, count: orders.filter((r) => r.distribution === key).length, ratio: orders.length ? new D(orders.filter((r) => r.distribution === key).length).div(orders.length).toFixed(6) : null }));
  const overview = { viewId, filterOptions, filters: { customer, status, risk, search }, scope: { asOf, knownAt, periodStart: displayStart, baselineMode, source: "imported", currency: "CNY", versionSet: orders.map((r) => ({ orderId: r.order.id, revisionId: r.revisionId, baselineId: r.baselineId, snapshotId: r.snapshotId })), note: "本地标准导入口径：CNY、生产等价收入、模拟报价不拆税。迟录和整套修订不纳入纯经营恶化判断。" }, coverage: { total: orders.length, known: orders.filter((r) => r.cumulative.actual.gross != null && asOf >= r.order.start).length, comparable: comparable.length, dayComparable: orders.filter((r) => r.comparison.status === "comparable").length, incomplete: orders.filter((r) => r.quality.missing.length > 0).length, exclusions: orders.filter((r) => !r.comparable || r.comparison.status !== "comparable").map((r) => ({ orderId: r.order.id, reasons: [...r.comparison.reasons, ...r.quality.missing.map((m) => `${m.date ?? ""} ${m.detail}`)] })) }, summary: { actualGross: sum3(comparable, (r) => r.cumulative.actual.gross), expectedGross: sum3(comparable, (r) => r.cumulative.expected.gross), gap: sum3(comparable, (r) => r.cumulative.gap), deteriorated: orders.filter((r) => r.comparison.deteriorated).length }, trend: { includedCount: intersection.length, excludedCount: orders.length - intersection.length, points: trend2 }, distribution: buckets, attention: orders.filter((r) => r.comparison.deteriorated).slice(0, 5).map((r) => r.order.id), reminders: orders.filter((r) => r.loss || r.cumulativeDeviation || r.quality.missing.length).map((r) => ({ orderId: r.order.id, loss: r.loss, cumulativeDeviation: r.cumulativeDeviation, incomplete: r.quality.missing.length > 0 })), orders };
  return { overview, snapshots: snapshots.filter((s) => orders.some((r) => r.snapshotId === s.snapshot_id)) };
}
function createMonitorService({ store, repository, clock = Date.now }) {
  return {
    async create(options = {}) {
      const knownAt = timestamp(options.knownAt ?? new Date(clock()).toISOString());
      if (Date.parse(knownAt) > clock()) throw fail("INVALID_REQUEST", "信息截止时间不能晚于服务端当前时间");
      const versions = await store.listVersions();
      const selected = /* @__PURE__ */ new Map();
      for (const v of versions) if (Date.parse(v.createdAt) <= Date.parse(knownAt)) {
        const old = selected.get(v.dataset.order.id);
        selected.set(v.dataset.order.id, { ...v, revisionCount: (old?.revisionCount ?? 0) + 1 });
      }
      const entries = [...selected.values()], asOf = options.asOf ?? (entries.length ? entries.reduce((s, v) => v.dataset.order.end > s ? v.dataset.order.end : s, entries[0].dataset.order.end) : new Date(clock() + 8 * 36e5).toISOString().slice(0, 10));
      const cacheKey = hash({ options: { ...options, asOf, knownAt: options.knownAt ?? null }, versions: entries.map((v) => [v.hash, v.createdAt, v.revisionCount]), visible: entries.map((v) => ["production", "materials", "expenses", "supplements"].map((k) => v.dataset[k].map((r) => !!r.availableAt && Date.parse(r.availableAt) <= Date.parse(knownAt)))) });
      if (repository.findCached) {
        const cached = await repository.findCached(cacheKey);
        if (cached) return cached;
      } else {
        const cached = (await repository.read()).views.find((v) => v.cacheKey === cacheKey && v.kind === "import-monitor");
        if (cached) return cached.overview;
      }
      const built = await buildOverview(entries, { ...options, asOf, knownAt });
      built.overview.coverage.unfilteredTotal = entries.length;
      if (repository.save) await repository.save(built.overview, built.snapshots, cacheKey);
      else await repository.transact((s) => {
        s.snapshots.push(...built.snapshots);
        s.views.push({ view_id: built.overview.viewId, kind: "import-monitor", cacheKey, overview: built.overview, recorded_at: new Date(clock()).toISOString() });
      });
      return built.overview;
    },
    async get(viewId) {
      if (repository.getView) {
        const v2 = await repository.getView(viewId);
        if (!v2) throw fail("VIEW_NOT_FOUND", "未找到固定监测视图", 404);
        return v2;
      }
      const s = await repository.read(), v = s.views.find((v2) => v2.view_id === viewId && v2.kind === "import-monitor");
      if (!v) throw fail("VIEW_NOT_FOUND", "未找到固定监测视图", 404);
      return v.overview;
    },
    async evidence(viewId, snapshotId) {
      const v = await this.get(viewId);
      if (!v.scope.versionSet.some((r) => r.snapshotId === snapshotId)) throw fail("SCOPE_MISMATCH", "快照不属于此视图", 409);
      const snapshot = repository.getSnapshot ? await repository.getSnapshot(viewId, snapshotId) : (await repository.read()).snapshots.find((x2) => x2.snapshot_id === snapshotId);
      if (!snapshot) throw fail("SNAPSHOT_NOT_FOUND", "快照不存在", 404);
      return { viewId, snapshotId, revisionId: snapshot.revision_id, baselineMode: snapshot.baseline_mode, asOf: snapshot.as_of, knownAt: snapshot.known_at, daily: snapshot.evaluation.daily, previous: snapshot.previous, evidence: snapshot.evidence };
    }
  };
}

// server/http/routes.mjs
import { randomUUID as randomUUID5, randomBytes } from "node:crypto";

// node_modules/fflate/esm/index.mjs
import { createRequire } from "module";
var require2 = createRequire("/");
var _a;
var Worker;
var isMarkedAsUntransferable;
try {
  _a = require2("worker_threads"), Worker = _a.Worker, isMarkedAsUntransferable = _a.isMarkedAsUntransferable;
} catch (e) {
}
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i2 = 0; i2 < 31; ++i2) {
    b[i2] = start += 1 << eb[i2 - 1];
  }
  var r = new i32(b[30]);
  for (var i2 = 1; i2 < 30; ++i2) {
    for (var j = b[i2]; j < b[i2 + 1]; ++j) {
      r[j] = j - b[i2] << 5 | i2;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (; i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1; i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v = le[cd[i2] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max2 = function(a) {
  var m = a[0];
  for (var i2 = 1; i2 < a.length; ++i2) {
    if (a[i2] > m)
      m = a[i2];
  }
  return m;
};
var bits = function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i2 = 0; i2 < hcLen; ++i2) {
          clt[clim[i2]] = bits(dat, pos + i2 * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max2(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i2 = 0; i2 < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i2++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i2++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max2(lt);
        dbt = max2(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add2 = sym - 254;
        if (sym > 264) {
          var i2 = sym - 257, b = fleb[i2];
          add2 = bits(dat, pos, (1 << b) - 1) + fl[i2];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add2;
        if (bt < dt) {
          var shift2 = dl - dt, dend = Math.min(dt, end);
          if (shift2 + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift2 + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var et = /* @__PURE__ */ new u8(0);
var b2 = function(d, b) {
  return d[b] | d[b + 1] << 8;
};
var b4 = function(d, b) {
  return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
};
var b8 = function(d, b) {
  return b4(d, b) + b4(d, b + 4) * 4294967296;
};
var Inflate = /* @__PURE__ */ (function() {
  function Inflate2(opts, cb) {
    if (typeof opts == "function")
      cb = opts, opts = {};
    this.ondata = cb;
    var dict = opts && opts.dictionary && opts.dictionary.subarray(-32768);
    this.s = { i: 0, b: dict ? dict.length : 0 };
    this.o = new u8(32768);
    this.p = new u8(0);
    if (dict)
      this.o.set(dict);
  }
  Inflate2.prototype.e = function(c) {
    if (!this.ondata)
      err(5);
    if (this.d)
      err(4);
    if (!this.p.length)
      this.p = c;
    else if (c.length) {
      var n = new u8(this.p.length + c.length);
      n.set(this.p), n.set(c, this.p.length), this.p = n;
    }
  };
  Inflate2.prototype.c = function(final) {
    this.s.i = +(this.d = final || false);
    var bts = this.s.b;
    var dt = inflt(this.p, this.s, this.o);
    this.ondata(slc(dt, bts, this.s.b), this.d);
    this.o = slc(dt, this.s.b - 32768), this.s.b = this.o.length;
    this.p = slc(this.p, this.s.p / 8 | 0), this.s.p &= 7;
  };
  Inflate2.prototype.push = function(chunk, final) {
    this.e(chunk), this.c(final);
  };
  return Inflate2;
})();
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
var dutf8 = function(d) {
  for (var r = "", i2 = 0; ; ) {
    var c = d[i2++];
    var eb = (c > 127) + (c > 223) + (c > 239);
    if (i2 + eb > d.length)
      return { s: r, r: slc(d, i2 - 1) };
    if (!eb)
      r += String.fromCharCode(c);
    else if (eb == 3) {
      c = ((c & 15) << 18 | (d[i2++] & 63) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
    } else if (eb & 1)
      r += String.fromCharCode((c & 31) << 6 | d[i2++] & 63);
    else
      r += String.fromCharCode((c & 15) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63);
  }
};
function strFromU8(dat, latin1) {
  if (latin1) {
    var r = "";
    for (var i2 = 0; i2 < dat.length; i2 += 16384)
      r += String.fromCharCode.apply(null, dat.subarray(i2, i2 + 16384));
    return r;
  } else if (td) {
    return td.decode(dat);
  } else {
    var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
    if (r.length)
      err(8);
    return s;
  }
}
var z64hs = function(d, b, l, z, sc, su, off) {
  var nsc = sc == 4294967295, nsu = su == 4294967295, noff = off == 4294967295, e = b + l;
  var nf = nsc + nsu + noff;
  if (z && nf) {
    for (; b + 4 < e; b += 4 + b2(d, b + 2)) {
      if (b2(d, b) == 1) {
        return [
          nsc ? b8(d, b + 4 + 8 * nsu) : sc,
          nsu ? b8(d, b + 4) : su,
          noff ? b8(d, b + 4 + 8 * (nsu + nsc)) : off,
          1
        ];
      }
    }
    if (z < 2)
      err(13);
  }
  return [sc, su, off, 0];
};
var UnzipPassThrough = /* @__PURE__ */ (function() {
  function UnzipPassThrough2() {
  }
  UnzipPassThrough2.prototype.push = function(chunk, final) {
    this.ondata(null, chunk, final);
  };
  UnzipPassThrough2.compression = 0;
  return UnzipPassThrough2;
})();
var UnzipInflate = /* @__PURE__ */ (function() {
  function UnzipInflate2() {
    var _this = this;
    this.i = new Inflate(function(dat, final) {
      _this.ondata(null, dat, final);
    });
  }
  UnzipInflate2.prototype.push = function(chunk, final) {
    try {
      this.i.push(chunk, final);
    } catch (e) {
      this.ondata(e, null, final);
    }
  };
  UnzipInflate2.compression = 8;
  return UnzipInflate2;
})();
var Unzip = /* @__PURE__ */ (function() {
  function Unzip2(cb) {
    this.onfile = cb;
    this.k = [];
    this.o = {
      0: UnzipPassThrough
    };
    this.p = et;
  }
  Unzip2.prototype.push = function(chunk, final) {
    var _this = this;
    if (!this.onfile)
      err(5);
    if (!this.p)
      err(4);
    if (this.c > 0) {
      var len = Math.min(this.c, chunk.length);
      var toAdd = chunk.subarray(0, len);
      this.c -= len;
      if (this.d)
        this.d.push(toAdd, !this.c);
      else
        this.k[0].push(toAdd);
      chunk = chunk.subarray(len);
      if (chunk.length)
        return this.push(chunk, final);
    } else {
      var f = 0, i2 = 0, is = void 0, buf = void 0;
      if (!this.p.length)
        buf = chunk;
      else if (!chunk.length)
        buf = this.p;
      else {
        buf = new u8(this.p.length + chunk.length);
        buf.set(this.p), buf.set(chunk, this.p.length);
      }
      var l = buf.length, oc = this.c, add2 = oc && this.d;
      var _loop_2 = function() {
        var sig = b4(buf, i2);
        if (sig == 67324752) {
          f = 1, is = i2;
          this_1.d = null;
          this_1.c = 0;
          var bf = b2(buf, i2 + 6), cmp_1 = b2(buf, i2 + 8), u = bf & 2048, dd = bf & 8, fnl = b2(buf, i2 + 26), es = b2(buf, i2 + 28);
          if (l > i2 + 30 + fnl + es) {
            var chks_3 = [];
            this_1.k.unshift(chks_3);
            f = 2;
            var lsc = b4(buf, i2 + 18), lsu = b4(buf, i2 + 22);
            var fn_1 = strFromU8(buf.subarray(i2 + 30, i2 += 30 + fnl), !u);
            var _a2 = z64hs(buf, i2, es, 2, lsc, lsu, 0), sc_1 = _a2[0], su_1 = _a2[1], z64 = _a2[3];
            if (dd)
              sc_1 = -1 - z64;
            i2 += es;
            this_1.c = sc_1;
            var d_1;
            var file_1 = {
              name: fn_1,
              compression: cmp_1,
              start: function() {
                if (!file_1.ondata)
                  err(5);
                if (!sc_1)
                  file_1.ondata(null, et, true);
                else {
                  var ctr = _this.o[cmp_1];
                  if (!ctr)
                    file_1.ondata(err(14, "unknown compression type " + cmp_1, 1), null, false);
                  d_1 = sc_1 < 0 ? new ctr(fn_1) : new ctr(fn_1, sc_1, su_1);
                  d_1.ondata = function(err2, dat3, final2) {
                    file_1.ondata(err2, dat3, final2);
                  };
                  for (var _i = 0, chks_4 = chks_3; _i < chks_4.length; _i++) {
                    var dat2 = chks_4[_i];
                    d_1.push(dat2, false);
                  }
                  if (_this.k[0] == chks_3 && _this.c)
                    _this.d = d_1;
                  else
                    d_1.push(et, true);
                }
              },
              terminate: function() {
                if (d_1 && d_1.terminate)
                  d_1.terminate();
              }
            };
            if (sc_1 >= 0)
              file_1.size = sc_1, file_1.originalSize = su_1;
            this_1.onfile(file_1);
          }
          return "break";
        } else if (oc) {
          if (sig == 134695760) {
            is = i2 += 12 + (oc == -2 && 8), f = 3, this_1.c = 0;
            return "break";
          } else if (sig == 33639248) {
            is = i2 -= 4, f = 3, this_1.c = 0;
            return "break";
          }
        }
      };
      var this_1 = this;
      for (; i2 < l - 4; ++i2) {
        var state_1 = _loop_2();
        if (state_1 === "break")
          break;
      }
      this.p = et;
      if (oc < 0) {
        var dat = f ? buf.subarray(0, is - 12 - (oc == -2 && 8) - (b4(buf, is - 16) == 134695760 && 4)) : buf.subarray(0, i2);
        if (add2)
          add2.push(dat, !!f);
        else
          this.k[+(f == 2)].push(dat);
      }
      if (f & 2)
        return this.push(buf.subarray(i2), final);
      this.p = buf.subarray(i2);
    }
    if (final) {
      if (this.c)
        err(13);
      this.p = null;
    }
  };
  Unzip2.prototype.register = function(decoder) {
    this.o[decoder.compression] = decoder;
  };
  return Unzip2;
})();

// node_modules/fast-xml-parser/src/util.js
var nameStartChar = ":A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
var nameChar = nameStartChar + "\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
var nameRegexp = "[" + nameStartChar + "][" + nameChar + "]*";
var regexName = new RegExp("^" + nameRegexp + "$");
function getAllMatches(string, regex) {
  const matches = [];
  let match = regex.exec(string);
  while (match) {
    const allmatches = [];
    allmatches.startIndex = regex.lastIndex - match[0].length;
    const len = match.length;
    for (let index = 0; index < len; index++) {
      allmatches.push(match[index]);
    }
    matches.push(allmatches);
    match = regex.exec(string);
  }
  return matches;
}
var isName = function(string) {
  const match = regexName.exec(string);
  return !(match === null || typeof match === "undefined");
};
function isExist(v) {
  return typeof v !== "undefined";
}
var DANGEROUS_PROPERTY_NAMES = [
  // '__proto__',
  // 'constructor',
  // 'prototype',
  "hasOwnProperty",
  "toString",
  "valueOf",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__"
];
var criticalProperties = ["__proto__", "constructor", "prototype"];

// node_modules/fast-xml-parser/src/validator.js
var defaultOptions = {
  allowBooleanAttributes: false,
  //A tag can have attributes without any value
  unpairedTags: []
};
function validate(xmlData, options) {
  options = Object.assign({}, defaultOptions, options);
  const tags = [];
  let tagFound = false;
  let reachedRoot = false;
  if (xmlData[0] === "\uFEFF") {
    xmlData = xmlData.substr(1);
  }
  for (let i2 = 0; i2 < xmlData.length; i2++) {
    if (xmlData[i2] === "<" && xmlData[i2 + 1] === "?") {
      i2 += 2;
      i2 = readPI(xmlData, i2);
      if (i2.err) return i2;
    } else if (xmlData[i2] === "<") {
      let tagStartPos = i2;
      i2++;
      if (xmlData[i2] === "!") {
        i2 = readCommentAndCDATA(xmlData, i2);
        continue;
      } else {
        let closingTag = false;
        if (xmlData[i2] === "/") {
          closingTag = true;
          i2++;
        }
        let tagName = "";
        for (; i2 < xmlData.length && xmlData[i2] !== ">" && xmlData[i2] !== " " && xmlData[i2] !== "	" && xmlData[i2] !== "\n" && xmlData[i2] !== "\r"; i2++) {
          tagName += xmlData[i2];
        }
        tagName = tagName.trim();
        if (tagName[tagName.length - 1] === "/") {
          tagName = tagName.substring(0, tagName.length - 1);
          i2--;
        }
        if (!validateTagName(tagName)) {
          let msg;
          if (tagName.trim().length === 0) {
            msg = "Invalid space after '<'.";
          } else {
            msg = "Tag '" + tagName + "' is an invalid name.";
          }
          return getErrorObject("InvalidTag", msg, getLineNumberForPosition(xmlData, i2));
        }
        const result = readAttributeStr(xmlData, i2);
        if (result === false) {
          return getErrorObject("InvalidAttr", "Attributes for '" + tagName + "' have open quote.", getLineNumberForPosition(xmlData, i2));
        }
        let attrStr = result.value;
        i2 = result.index;
        if (attrStr[attrStr.length - 1] === "/") {
          const attrStrStart = i2 - attrStr.length;
          attrStr = attrStr.substring(0, attrStr.length - 1);
          const isValid = validateAttributeString(attrStr, options);
          if (isValid === true) {
            tagFound = true;
          } else {
            return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, attrStrStart + isValid.err.line));
          }
        } else if (closingTag) {
          if (!result.tagClosed) {
            return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' doesn't have proper closing.", getLineNumberForPosition(xmlData, i2));
          } else if (attrStr.trim().length > 0) {
            return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' can't have attributes or invalid starting.", getLineNumberForPosition(xmlData, tagStartPos));
          } else if (tags.length === 0) {
            return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' has not been opened.", getLineNumberForPosition(xmlData, tagStartPos));
          } else {
            const otg = tags.pop();
            if (tagName !== otg.tagName) {
              let openPos = getLineNumberForPosition(xmlData, otg.tagStartPos);
              return getErrorObject(
                "InvalidTag",
                "Expected closing tag '" + otg.tagName + "' (opened in line " + openPos.line + ", col " + openPos.col + ") instead of closing tag '" + tagName + "'.",
                getLineNumberForPosition(xmlData, tagStartPos)
              );
            }
            if (tags.length == 0) {
              reachedRoot = true;
            }
          }
        } else {
          const isValid = validateAttributeString(attrStr, options);
          if (isValid !== true) {
            return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, i2 - attrStr.length + isValid.err.line));
          }
          if (reachedRoot === true) {
            return getErrorObject("InvalidXml", "Multiple possible root nodes found.", getLineNumberForPosition(xmlData, i2));
          } else if (options.unpairedTags.indexOf(tagName) !== -1) {
          } else {
            tags.push({ tagName, tagStartPos });
          }
          tagFound = true;
        }
        for (i2++; i2 < xmlData.length; i2++) {
          if (xmlData[i2] === "<") {
            if (xmlData[i2 + 1] === "!") {
              i2++;
              i2 = readCommentAndCDATA(xmlData, i2);
              continue;
            } else if (xmlData[i2 + 1] === "?") {
              i2 = readPI(xmlData, ++i2);
              if (i2.err) return i2;
            } else {
              break;
            }
          } else if (xmlData[i2] === "&") {
            const afterAmp = validateAmpersand(xmlData, i2);
            if (afterAmp == -1)
              return getErrorObject("InvalidChar", "char '&' is not expected.", getLineNumberForPosition(xmlData, i2));
            i2 = afterAmp;
          } else {
            if (reachedRoot === true && !isWhiteSpace(xmlData[i2])) {
              return getErrorObject("InvalidXml", "Extra text at the end", getLineNumberForPosition(xmlData, i2));
            }
          }
        }
        if (xmlData[i2] === "<") {
          i2--;
        }
      }
    } else {
      if (isWhiteSpace(xmlData[i2])) {
        continue;
      }
      return getErrorObject("InvalidChar", "char '" + xmlData[i2] + "' is not expected.", getLineNumberForPosition(xmlData, i2));
    }
  }
  if (!tagFound) {
    return getErrorObject("InvalidXml", "Start tag expected.", 1);
  } else if (tags.length == 1) {
    return getErrorObject("InvalidTag", "Unclosed tag '" + tags[0].tagName + "'.", getLineNumberForPosition(xmlData, tags[0].tagStartPos));
  } else if (tags.length > 0) {
    return getErrorObject("InvalidXml", "Invalid '" + JSON.stringify(tags.map((t) => t.tagName), null, 4).replace(/\r?\n/g, "") + "' found.", { line: 1, col: 1 });
  }
  return true;
}
function isWhiteSpace(char) {
  return char === " " || char === "	" || char === "\n" || char === "\r";
}
function readPI(xmlData, i2) {
  const start = i2;
  for (; i2 < xmlData.length; i2++) {
    if (xmlData[i2] == "?" || xmlData[i2] == " ") {
      const tagname = xmlData.substr(start, i2 - start);
      if (i2 > 5 && tagname === "xml") {
        return getErrorObject("InvalidXml", "XML declaration allowed only at the start of the document.", getLineNumberForPosition(xmlData, i2));
      } else if (xmlData[i2] == "?" && xmlData[i2 + 1] == ">") {
        i2++;
        break;
      } else {
        continue;
      }
    }
  }
  return i2;
}
function readCommentAndCDATA(xmlData, i2) {
  if (xmlData.length > i2 + 5 && xmlData[i2 + 1] === "-" && xmlData[i2 + 2] === "-") {
    for (i2 += 3; i2 < xmlData.length; i2++) {
      if (xmlData[i2] === "-" && xmlData[i2 + 1] === "-" && xmlData[i2 + 2] === ">") {
        i2 += 2;
        break;
      }
    }
  } else if (xmlData.length > i2 + 8 && xmlData[i2 + 1] === "D" && xmlData[i2 + 2] === "O" && xmlData[i2 + 3] === "C" && xmlData[i2 + 4] === "T" && xmlData[i2 + 5] === "Y" && xmlData[i2 + 6] === "P" && xmlData[i2 + 7] === "E") {
    let angleBracketsCount = 1;
    for (i2 += 8; i2 < xmlData.length; i2++) {
      if (xmlData[i2] === "<") {
        angleBracketsCount++;
      } else if (xmlData[i2] === ">") {
        angleBracketsCount--;
        if (angleBracketsCount === 0) {
          break;
        }
      }
    }
  } else if (xmlData.length > i2 + 9 && xmlData[i2 + 1] === "[" && xmlData[i2 + 2] === "C" && xmlData[i2 + 3] === "D" && xmlData[i2 + 4] === "A" && xmlData[i2 + 5] === "T" && xmlData[i2 + 6] === "A" && xmlData[i2 + 7] === "[") {
    for (i2 += 8; i2 < xmlData.length; i2++) {
      if (xmlData[i2] === "]" && xmlData[i2 + 1] === "]" && xmlData[i2 + 2] === ">") {
        i2 += 2;
        break;
      }
    }
  }
  return i2;
}
var doubleQuote = '"';
var singleQuote = "'";
function readAttributeStr(xmlData, i2) {
  let attrStr = "";
  let startChar = "";
  let tagClosed = false;
  for (; i2 < xmlData.length; i2++) {
    if (xmlData[i2] === doubleQuote || xmlData[i2] === singleQuote) {
      if (startChar === "") {
        startChar = xmlData[i2];
      } else if (startChar !== xmlData[i2]) {
      } else {
        startChar = "";
      }
    } else if (xmlData[i2] === ">") {
      if (startChar === "") {
        tagClosed = true;
        break;
      }
    }
    attrStr += xmlData[i2];
  }
  if (startChar !== "") {
    return false;
  }
  return {
    value: attrStr,
    index: i2,
    tagClosed
  };
}
function scanAttributeTokens(attrStr) {
  const tokens = [];
  const len = attrStr.length;
  let i2 = 0;
  while (i2 < len) {
    const tokenStart = i2;
    while (i2 < len && isWhiteSpace(attrStr[i2])) i2++;
    if (i2 >= len) break;
    if (attrStr[i2] === "=") {
      i2 = tokenStart + 1;
      continue;
    }
    const leadingWs = attrStr.slice(tokenStart, i2);
    const nameStart = i2;
    while (i2 < len && !isWhiteSpace(attrStr[i2]) && attrStr[i2] !== "=") i2++;
    const name = attrStr.slice(nameStart, i2);
    let equalsGroup;
    let j = i2;
    while (j < len && isWhiteSpace(attrStr[j])) j++;
    if (j < len && attrStr[j] === "=") {
      equalsGroup = attrStr.slice(i2, j + 1);
      i2 = j + 1;
    }
    let quoteChar;
    let value;
    let k = i2;
    while (k < len && isWhiteSpace(attrStr[k])) k++;
    if (k < len && (attrStr[k] === '"' || attrStr[k] === "'")) {
      const valueStart = k + 1;
      const closeIdx = attrStr.indexOf(attrStr[k], valueStart);
      if (closeIdx !== -1) {
        quoteChar = attrStr[k];
        value = attrStr.slice(valueStart, closeIdx);
        i2 = closeIdx + 1;
      }
    }
    const token = { startIndex: tokenStart };
    token[1] = leadingWs;
    token[2] = name;
    token[3] = equalsGroup;
    token[4] = quoteChar !== void 0 ? true : void 0;
    token[5] = quoteChar;
    token[6] = value;
    tokens.push(token);
  }
  return tokens;
}
function validateAttributeString(attrStr, options) {
  const matches = scanAttributeTokens(attrStr);
  const attrNames = {};
  for (let i2 = 0; i2 < matches.length; i2++) {
    if (matches[i2][1].length === 0) {
      return getErrorObject("InvalidAttr", "Attribute '" + matches[i2][2] + "' has no space in starting.", getPositionFromMatch(matches[i2]));
    } else if (matches[i2][3] !== void 0 && matches[i2][4] === void 0) {
      return getErrorObject("InvalidAttr", "Attribute '" + matches[i2][2] + "' is without value.", getPositionFromMatch(matches[i2]));
    } else if (matches[i2][3] === void 0 && !options.allowBooleanAttributes) {
      return getErrorObject("InvalidAttr", "boolean attribute '" + matches[i2][2] + "' is not allowed.", getPositionFromMatch(matches[i2]));
    }
    const attrName = matches[i2][2];
    if (!validateAttrName(attrName)) {
      return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is an invalid name.", getPositionFromMatch(matches[i2]));
    }
    if (!Object.prototype.hasOwnProperty.call(attrNames, attrName)) {
      attrNames[attrName] = 1;
    } else {
      return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is repeated.", getPositionFromMatch(matches[i2]));
    }
  }
  return true;
}
function validateNumberAmpersand(xmlData, i2) {
  let re = /\d/;
  if (xmlData[i2] === "x") {
    i2++;
    re = /[\da-fA-F]/;
  }
  for (; i2 < xmlData.length; i2++) {
    if (xmlData[i2] === ";")
      return i2;
    if (!xmlData[i2].match(re))
      break;
  }
  return -1;
}
function validateAmpersand(xmlData, i2) {
  i2++;
  if (xmlData[i2] === ";")
    return -1;
  if (xmlData[i2] === "#") {
    i2++;
    return validateNumberAmpersand(xmlData, i2);
  }
  let count = 0;
  for (; i2 < xmlData.length; i2++, count++) {
    if (xmlData[i2].match(/\w/) && count < 20)
      continue;
    if (xmlData[i2] === ";")
      break;
    return -1;
  }
  return i2;
}
function getErrorObject(code, message, lineNumber) {
  return {
    err: {
      code,
      msg: message,
      line: lineNumber.line || lineNumber,
      col: lineNumber.col
    }
  };
}
function validateAttrName(attrName) {
  return isName(attrName);
}
function validateTagName(tagname) {
  return isName(tagname);
}
function getLineNumberForPosition(xmlData, index) {
  const lines = xmlData.substring(0, index).split(/\r?\n/);
  return {
    line: lines.length,
    // column number is last line's length + 1, because column numbering starts at 1:
    col: lines[lines.length - 1].length + 1
  };
}
function getPositionFromMatch(match) {
  return match.startIndex + match[1].length;
}

// node_modules/@nodable/entities/src/entities.js
var CURRENCY = {
  cent: "¢",
  pound: "£",
  curren: "¤",
  yen: "¥",
  euro: "€",
  dollar: "$",
  fnof: "ƒ",
  inr: "₹",
  af: "؋",
  birr: "ብር",
  peso: "₱",
  rub: "₽",
  won: "₩",
  yuan: "¥",
  cedil: "¸"
};
var XML = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"'
};
var COMMON_HTML = {
  nbsp: " ",
  copy: "©",
  reg: "®",
  trade: "™",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  para: "¶",
  sect: "§",
  deg: "°",
  frac12: "½",
  frac14: "¼",
  frac34: "¾"
};

// node_modules/@nodable/entities/src/EntityDecoder.js
var ENTITY_ACTION = Object.freeze({
  /** Resolve and expand the entity normally. */
  ALLOW: "allow",
  /** Silently skip this entity — it will not be registered. */
  BLOCK: "block",
  /** Throw an error, aborting entity registration entirely. */
  THROW: "throw"
});
var SPECIAL_CHARS = new Set("!?\\\\/[]$%{}^&*()<>|+");
function validateEntityName(name) {
  if (name[0] === "#") {
    throw new Error(`[EntityReplacer] Invalid character '#' in entity name: "${name}"`);
  }
  for (const ch of name) {
    if (SPECIAL_CHARS.has(ch)) {
      throw new Error(`[EntityReplacer] Invalid character '${ch}' in entity name: "${name}"`);
    }
  }
  return name;
}
function mergeEntityMaps(...maps) {
  const out = /* @__PURE__ */ Object.create(null);
  for (const map of maps) {
    if (!map) continue;
    for (const key of Object.keys(map)) {
      const raw = map[key];
      if (typeof raw === "string") {
        out[key] = raw;
      } else if (raw && typeof raw === "object" && raw.val !== void 0) {
        const val = raw.val;
        if (typeof val === "string") {
          out[key] = val;
        }
      }
    }
  }
  return out;
}
var LIMIT_TIER_EXTERNAL = "external";
var LIMIT_TIER_BASE = "base";
var LIMIT_TIER_ALL = "all";
function parseLimitTiers(raw) {
  if (!raw || raw === LIMIT_TIER_EXTERNAL) return /* @__PURE__ */ new Set([LIMIT_TIER_EXTERNAL]);
  if (raw === LIMIT_TIER_ALL) return /* @__PURE__ */ new Set([LIMIT_TIER_ALL]);
  if (raw === LIMIT_TIER_BASE) return /* @__PURE__ */ new Set([LIMIT_TIER_BASE]);
  if (Array.isArray(raw)) return new Set(raw);
  return /* @__PURE__ */ new Set([LIMIT_TIER_EXTERNAL]);
}
var NCR_LEVEL = Object.freeze({ allow: 0, leave: 1, remove: 2, throw: 3 });
var XML10_ALLOWED_C0 = /* @__PURE__ */ new Set([9, 10, 13]);
function parseNCRConfig(ncr) {
  if (!ncr) {
    return { xmlVersion: 1, onLevel: NCR_LEVEL.allow, nullLevel: NCR_LEVEL.remove };
  }
  const xmlVersion = ncr.xmlVersion === 1.1 ? 1.1 : 1;
  const onLevel = NCR_LEVEL[ncr.onNCR] ?? NCR_LEVEL.allow;
  const nullLevel = NCR_LEVEL[ncr.nullNCR] ?? NCR_LEVEL.remove;
  const clampedNull = Math.max(nullLevel, NCR_LEVEL.remove);
  return { xmlVersion, onLevel, nullLevel: clampedNull };
}
var EntityDecoder = class {
  /**
   * @param {object} [options]
   * @param {object|null}  [options.namedEntities]        — extra named entities merged into base map
   * @param {object}  [options.limit]                 — security limits
   * @param {number}       [options.limit.maxTotalExpansions=0]  — 0 = unlimited
   * @param {number}       [options.limit.maxExpandedLength=0]   — 0 = unlimited
   * @param {'external'|'base'|'all'|string[]} [options.limit.applyLimitsTo='external']
   *   Which entity tiers count against the security limits:
   *   - 'external' (default) — only input/runtime + persistent external entities
   *   - 'base'               — only DEFAULT_XML_ENTITIES + namedEntities
   *   - 'all'                — every entity regardless of tier
   *   - string[]             — explicit combination, e.g. ['external', 'base']
   * @param {((resolved: string, original: string) => string)|null} [options.postCheck=null]
   * @param {string[]} [options.remove=[]] — entity names (e.g. ['nbsp', '#13']) to delete (replace with empty string)
   * @param {string[]} [options.leave=[]]  — entity names to keep as literal (unchanged in output)
   * @param {object}   [options.ncr]       — Numeric Character Reference controls
   * @param {1.0|1.1}  [options.ncr.xmlVersion=1.0]
   *   XML version governing which codepoint ranges are restricted:
   *   - 1.0 — C0 controls U+0001–U+001F (except U+0009/000A/000D) are prohibited
   *   - 1.1 — C0 controls are allowed when written as NCRs; C1 (U+007F–U+009F) decoded as-is
   * @param {'allow'|'leave'|'remove'|'throw'} [options.ncr.onNCR='allow']
   *   Base action for numeric references. Severity order: allow < leave < remove < throw.
   *   For codepoint ranges that carry a minimum level (surrogates → remove, XML 1.0 C0 → remove),
   *   the effective action is max(onNCR, rangeMinimum).
   * @param {'remove'|'throw'} [options.ncr.nullNCR='remove']
   *   Action for U+0000 (null). 'allow' and 'leave' are clamped to 'remove' since null is never safe.
   * @param {((name: string, value: string) => 'allow'|'block'|'throw')|null} [options.onExternalEntity=null]
   *   Hook called when an external entity is registered via `setExternalEntities()` or
   *   `addExternalEntity()`. Return `ENTITY_ACTION.ALLOW` to accept the entity,
   *   `ENTITY_ACTION.BLOCK` to silently skip it, or `ENTITY_ACTION.THROW` to abort with an error.
   * @param {((name: string, value: string) => 'allow'|'block'|'throw')|null} [options.onInputEntity=null]
   *   Hook called when an input entity is registered via `addInputEntities()`. Return
   *   `ENTITY_ACTION.ALLOW` to accept, `ENTITY_ACTION.BLOCK` to silently skip, or
   *   `ENTITY_ACTION.THROW` to abort with an error.
   */
  constructor(options = {}) {
    this._limit = options.limit || {};
    this._maxTotalExpansions = this._limit.maxTotalExpansions || 0;
    this._maxExpandedLength = this._limit.maxExpandedLength || 0;
    this._postCheck = typeof options.postCheck === "function" ? options.postCheck : (r) => r;
    this._limitTiers = parseLimitTiers(this._limit.applyLimitsTo ?? LIMIT_TIER_EXTERNAL);
    this._numericAllowed = options.numericAllowed ?? true;
    this._baseMap = mergeEntityMaps(XML, options.namedEntities || null);
    this._externalMap = /* @__PURE__ */ Object.create(null);
    this._inputMap = /* @__PURE__ */ Object.create(null);
    this._totalExpansions = 0;
    this._expandedLength = 0;
    this._removeSet = new Set(options.remove && Array.isArray(options.remove) ? options.remove : []);
    this._leaveSet = new Set(options.leave && Array.isArray(options.leave) ? options.leave : []);
    const ncrCfg = parseNCRConfig(options.ncr);
    this._ncrXmlVersion = ncrCfg.xmlVersion;
    this._ncrOnLevel = ncrCfg.onLevel;
    this._ncrNullLevel = ncrCfg.nullLevel;
    this._onExternalEntity = typeof options.onExternalEntity === "function" ? options.onExternalEntity : null;
    this._onInputEntity = typeof options.onInputEntity === "function" ? options.onInputEntity : null;
  }
  // -------------------------------------------------------------------------
  // Private: registration hook dispatch
  // -------------------------------------------------------------------------
  /**
   * Invoke a registration hook for a single entity name/value pair.
   * Returns true when the entity should be accepted, false when it should be
   * silently skipped (BLOCK), and throws when the hook returns THROW.
   *
   * @param {((name: string, value: string) => 'allow'|'block'|'throw')|null} hook
   * @param {string} name
   * @param {string} value
   * @param {string} context  — used in error messages ('external' | 'input')
   * @returns {boolean}  true = accept, false = skip
   */
  _applyRegistrationHook(hook, name, value, context) {
    if (!hook) return true;
    const action = hook(name, value);
    if (action === ENTITY_ACTION.BLOCK) return false;
    if (action === ENTITY_ACTION.THROW) {
      throw new Error(
        `[EntityDecoder] Registration of ${context} entity "&${name};" was rejected by hook`
      );
    }
    return true;
  }
  // -------------------------------------------------------------------------
  // Persistent external entity registration
  // -------------------------------------------------------------------------
  /**
   * Replace the full set of persistent external entities.
   * All keys are validated — throws on invalid characters.
   * If `onExternalEntity` is set, it is called once per entry; entries that
   * return `ENTITY_ACTION.BLOCK` are silently omitted, `ENTITY_ACTION.THROW`
   * aborts the whole call.
   * @param {Record<string, string | { regex?: RegExp, val: string }>} map
   */
  setExternalEntities(map) {
    if (map) {
      for (const key of Object.keys(map)) {
        validateEntityName(key);
      }
    }
    if (!this._onExternalEntity) {
      this._externalMap = mergeEntityMaps(map);
      return;
    }
    const flat = mergeEntityMaps(map);
    const filtered = /* @__PURE__ */ Object.create(null);
    for (const [name, value] of Object.entries(flat)) {
      if (this._applyRegistrationHook(this._onExternalEntity, name, value, "external")) {
        filtered[name] = value;
      }
    }
    this._externalMap = filtered;
  }
  /**
   * Add a single persistent external entity.
   * If `onExternalEntity` is set it is called before the entity is stored;
   * `ENTITY_ACTION.BLOCK` silently skips storage, `ENTITY_ACTION.THROW` raises.
   * @param {string} key
   * @param {string} value
   */
  addExternalEntity(key, value) {
    validateEntityName(key);
    if (typeof value === "string" && value.indexOf("&") === -1) {
      if (this._applyRegistrationHook(this._onExternalEntity, key, value, "external")) {
        this._externalMap[key] = value;
      }
    }
  }
  // -------------------------------------------------------------------------
  // Input / runtime entity registration (per document)
  // -------------------------------------------------------------------------
  /**
   * Inject DOCTYPE entities for the current document.
   * Also resets per-document expansion counters.
   * If `onInputEntity` is set it is called once per entry; entries returning
   * `ENTITY_ACTION.BLOCK` are silently omitted, `ENTITY_ACTION.THROW` aborts.
   * @param {Record<string, string | { regx?: RegExp, regex?: RegExp, val: string }>} map
   */
  addInputEntities(map) {
    this._totalExpansions = 0;
    this._expandedLength = 0;
    if (!this._onInputEntity) {
      this._inputMap = mergeEntityMaps(map);
      return;
    }
    const flat = mergeEntityMaps(map);
    const filtered = /* @__PURE__ */ Object.create(null);
    for (const [name, value] of Object.entries(flat)) {
      if (this._applyRegistrationHook(this._onInputEntity, name, value, "input")) {
        filtered[name] = value;
      }
    }
    this._inputMap = filtered;
  }
  // -------------------------------------------------------------------------
  // Per-document reset
  // -------------------------------------------------------------------------
  /**
   * Wipe input/runtime entities and reset counters.
   * Call this before processing each new document.
   * @returns {this}
   */
  reset() {
    this._inputMap = /* @__PURE__ */ Object.create(null);
    this._totalExpansions = 0;
    this._expandedLength = 0;
    return this;
  }
  // -------------------------------------------------------------------------
  // XML version (can be set after construction, e.g. once parser reads <?xml?>)
  // -------------------------------------------------------------------------
  /**
   * Update the XML version used for NCR classification.
   * Call this as soon as the document's `<?xml version="...">` declaration is parsed.
   * @param {1.0|1.1|number} version
   */
  setXmlVersion(version) {
    this._ncrXmlVersion = version === 1.1 ? 1.1 : 1;
  }
  // -------------------------------------------------------------------------
  // Primary API
  // -------------------------------------------------------------------------
  /**
   * Replace all entity references in `str` in a single pass.
   *
   * @param {string} str
   * @returns {string}
   */
  decode(str) {
    if (typeof str !== "string" || str.length === 0) return str;
    if (str.indexOf("&") === -1) return str;
    const original = str;
    const chunks = [];
    const len = str.length;
    let last = 0;
    let i2 = 0;
    const limitExpansions = this._maxTotalExpansions > 0;
    const limitLength = this._maxExpandedLength > 0;
    const checkLimits = limitExpansions || limitLength;
    while (i2 < len) {
      if (str.charCodeAt(i2) !== 38) {
        i2++;
        continue;
      }
      let j = i2 + 1;
      while (j < len && str.charCodeAt(j) !== 59 && j - i2 <= 32) j++;
      if (j >= len || str.charCodeAt(j) !== 59) {
        i2++;
        continue;
      }
      const token = str.slice(i2 + 1, j);
      if (token.length === 0) {
        i2++;
        continue;
      }
      let replacement;
      let tier;
      if (this._removeSet.has(token)) {
        replacement = "";
        if (tier === void 0) {
          tier = LIMIT_TIER_EXTERNAL;
        }
      } else if (this._leaveSet.has(token)) {
        i2++;
        continue;
      } else if (token.charCodeAt(0) === 35) {
        const ncrResult = this._resolveNCR(token);
        if (ncrResult === void 0) {
          i2++;
          continue;
        }
        replacement = ncrResult;
        tier = LIMIT_TIER_BASE;
      } else {
        const resolved = this._resolveName(token);
        replacement = resolved?.value;
        tier = resolved?.tier;
      }
      if (replacement === void 0) {
        i2++;
        continue;
      }
      if (i2 > last) chunks.push(str.slice(last, i2));
      chunks.push(replacement);
      last = j + 1;
      i2 = last;
      if (checkLimits && this._tierCounts(tier)) {
        if (limitExpansions) {
          this._totalExpansions++;
          if (this._totalExpansions > this._maxTotalExpansions) {
            throw new Error(
              `[EntityReplacer] Entity expansion count limit exceeded: ${this._totalExpansions} > ${this._maxTotalExpansions}`
            );
          }
        }
        if (limitLength) {
          const delta = replacement.length - (token.length + 2);
          if (delta > 0) {
            this._expandedLength += delta;
            if (this._expandedLength > this._maxExpandedLength) {
              throw new Error(
                `[EntityReplacer] Expanded content length limit exceeded: ${this._expandedLength} > ${this._maxExpandedLength}`
              );
            }
          }
        }
      }
    }
    if (last < len) chunks.push(str.slice(last));
    const result = chunks.length === 0 ? str : chunks.join("");
    return this._postCheck(result, original);
  }
  // -------------------------------------------------------------------------
  // Private: limit tier check
  // -------------------------------------------------------------------------
  /**
   * Returns true if a resolved entity of the given tier should count
   * against the expansion/length limits.
   * @param {string} tier  — LIMIT_TIER_EXTERNAL | LIMIT_TIER_BASE
   * @returns {boolean}
   */
  _tierCounts(tier) {
    if (this._limitTiers.has(LIMIT_TIER_ALL)) return true;
    return this._limitTiers.has(tier);
  }
  // -------------------------------------------------------------------------
  // Private: entity resolution
  // -------------------------------------------------------------------------
  /**
   * Resolve a named entity token (without & and ;).
   * Priority: inputMap > externalMap > baseMap
   * Returns the resolved value tagged with its limit tier.
   *
   * @param {string} name
   * @returns {{ value: string, tier: string }|undefined}
   */
  _resolveName(name) {
    if (name in this._inputMap) return { value: this._inputMap[name], tier: LIMIT_TIER_EXTERNAL };
    if (name in this._externalMap) return { value: this._externalMap[name], tier: LIMIT_TIER_EXTERNAL };
    if (name in this._baseMap) return { value: this._baseMap[name], tier: LIMIT_TIER_BASE };
    return void 0;
  }
  /**
   * Classify a codepoint and return the minimum action level that must be applied.
   * Returns -1 when no minimum is imposed (normal allow path).
   *
   * Ranges checked (in priority order):
   *   1. U+0000            — null, governed by nullNCR (always ≥ remove)
   *   2. U+D800–U+DFFF     — surrogates, always prohibited (min: remove)
   *   3. U+0001–U+001F \ {0x09,0x0A,0x0D}  — XML 1.0 restricted C0 (min: remove)
   *      (skipped in XML 1.1 — C0 controls are allowed when written as NCRs)
   *
   * @param {number} cp  — codepoint
   * @returns {number}   — minimum NCR_LEVEL value, or -1 for no restriction
   */
  _classifyNCR(cp) {
    if (cp === 0) return this._ncrNullLevel;
    if (cp >= 55296 && cp <= 57343) return NCR_LEVEL.remove;
    if (this._ncrXmlVersion === 1) {
      if (cp >= 1 && cp <= 31 && !XML10_ALLOWED_C0.has(cp)) return NCR_LEVEL.remove;
    }
    return -1;
  }
  /**
   * Execute a resolved NCR action.
   *
   * @param {number} action   — NCR_LEVEL value
   * @param {string} token    — raw token (e.g. '#38') for error messages
   * @param {number} cp       — codepoint, used only for error messages
   * @returns {string|undefined}
   *   - decoded character string  → 'allow'
   *   - ''                        → 'remove'
   *   - undefined                 → 'leave' (caller must skip past '&' only)
   *   - throws Error              → 'throw'
   */
  _applyNCRAction(action, token, cp) {
    switch (action) {
      case NCR_LEVEL.allow:
        return String.fromCodePoint(cp);
      case NCR_LEVEL.remove:
        return "";
      case NCR_LEVEL.leave:
        return void 0;
      // signal: keep literal
      case NCR_LEVEL.throw:
        throw new Error(
          `[EntityDecoder] Prohibited numeric character reference &${token}; (U+${cp.toString(16).toUpperCase().padStart(4, "0")})`
        );
      default:
        return String.fromCodePoint(cp);
    }
  }
  /**
   * Full NCR resolution pipeline for a numeric token.
   *
   * Steps:
   *   1. Parse the codepoint (decimal or hex).
   *   2. Validate the raw codepoint range (NaN, <0, >0x10FFFF).
   *   3. If numericAllowed is false and no minimum restriction applies → leave as-is.
   *   4. Classify the codepoint to find the minimum required action level.
   *   5. Resolve effective action = max(onNCR, minimum).
   *   6. Apply and return.
   *
   * @param {string} token  — e.g. '#38', '#x26', '#X26'
   * @returns {string|undefined}
   *   - string (incl. '')  — replacement ('' = remove)
   *   - undefined          — leave original &token; as-is
   */
  _resolveNCR(token) {
    const second = token.charCodeAt(1);
    let cp;
    if (second === 120 || second === 88) {
      cp = parseInt(token.slice(2), 16);
    } else {
      cp = parseInt(token.slice(1), 10);
    }
    if (Number.isNaN(cp) || cp < 0 || cp > 1114111) return void 0;
    const minimum = this._classifyNCR(cp);
    if (!this._numericAllowed && minimum < NCR_LEVEL.remove) return void 0;
    const effective = minimum === -1 ? this._ncrOnLevel : Math.max(this._ncrOnLevel, minimum);
    return this._applyNCRAction(effective, token, cp);
  }
};

// node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js
var defaultOnDangerousProperty = (name) => {
  if (DANGEROUS_PROPERTY_NAMES.includes(name)) {
    return "__" + name;
  }
  return name;
};
var defaultOptions2 = {
  preserveOrder: false,
  attributeNamePrefix: "@_",
  attributesGroupName: false,
  textNodeName: "#text",
  ignoreAttributes: true,
  removeNSPrefix: false,
  // remove NS from tag name or attribute name if true
  allowBooleanAttributes: false,
  //a tag can have attributes without any value
  //ignoreRootElement : false,
  parseTagValue: true,
  parseAttributeValue: false,
  trimValues: true,
  //Trim string values of tag and attributes
  cdataPropName: false,
  numberParseOptions: {
    hex: true,
    leadingZeros: true,
    eNotation: true,
    unicode: false
  },
  tagValueProcessor: function(tagName, val) {
    return val;
  },
  attributeValueProcessor: function(attrName, val) {
    return val;
  },
  stopNodes: [],
  //nested tags will not be parsed even for errors
  alwaysCreateTextNode: false,
  isArray: () => false,
  commentPropName: false,
  unpairedTags: [],
  processEntities: true,
  htmlEntities: false,
  entityDecoder: null,
  ignoreDeclaration: false,
  ignorePiTags: false,
  transformTagName: false,
  transformAttributeName: false,
  updateTag: function(tagName, jPath, attrs) {
    return tagName;
  },
  // skipEmptyListItem: false
  captureMetaData: false,
  maxNestedTags: 100,
  strictReservedNames: true,
  jPath: true,
  // if true, pass jPath string to callbacks; if false, pass matcher instance
  onDangerousProperty: defaultOnDangerousProperty
};
function validatePropertyName(propertyName, optionName) {
  if (typeof propertyName !== "string") {
    return;
  }
  const normalized = propertyName.toLowerCase();
  if (DANGEROUS_PROPERTY_NAMES.some((dangerous) => normalized === dangerous.toLowerCase())) {
    throw new Error(
      `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
    );
  }
  if (criticalProperties.some((dangerous) => normalized === dangerous.toLowerCase())) {
    throw new Error(
      `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
    );
  }
}
function normalizeProcessEntities(value, htmlEntities) {
  if (typeof value === "boolean") {
    return {
      enabled: value,
      // true or false
      maxEntitySize: 1e4,
      maxExpansionDepth: 1e4,
      maxTotalExpansions: Infinity,
      maxExpandedLength: 1e5,
      maxEntityCount: 1e3,
      allowedTags: null,
      tagFilter: null,
      appliesTo: "all"
    };
  }
  if (typeof value === "object" && value !== null) {
    return {
      enabled: value.enabled !== false,
      maxEntitySize: Math.max(1, value.maxEntitySize ?? 1e4),
      maxExpansionDepth: Math.max(1, value.maxExpansionDepth ?? 1e4),
      maxTotalExpansions: Math.max(1, value.maxTotalExpansions ?? Infinity),
      maxExpandedLength: Math.max(1, value.maxExpandedLength ?? 1e5),
      maxEntityCount: Math.max(1, value.maxEntityCount ?? 1e3),
      allowedTags: value.allowedTags ?? null,
      tagFilter: value.tagFilter ?? null,
      appliesTo: value.appliesTo ?? "all"
    };
  }
  return normalizeProcessEntities(true);
}
var buildOptions = function(options) {
  const built = Object.assign({}, defaultOptions2, options);
  const propertyNameOptions = [
    { value: built.attributeNamePrefix, name: "attributeNamePrefix" },
    { value: built.attributesGroupName, name: "attributesGroupName" },
    { value: built.textNodeName, name: "textNodeName" },
    { value: built.cdataPropName, name: "cdataPropName" },
    { value: built.commentPropName, name: "commentPropName" }
  ];
  for (const { value, name } of propertyNameOptions) {
    if (value) {
      validatePropertyName(value, name);
    }
  }
  if (built.onDangerousProperty === null) {
    built.onDangerousProperty = defaultOnDangerousProperty;
  }
  built.processEntities = normalizeProcessEntities(built.processEntities, built.htmlEntities);
  built.unpairedTagsSet = new Set(built.unpairedTags);
  if (built.stopNodes && Array.isArray(built.stopNodes)) {
    built.stopNodes = built.stopNodes.map((node) => {
      if (typeof node === "string" && node.startsWith("*.")) {
        return ".." + node.substring(2);
      }
      return node;
    });
  }
  return built;
};

// node_modules/fast-xml-parser/src/xmlparser/xmlNode.js
var METADATA_SYMBOL;
if (typeof Symbol !== "function") {
  METADATA_SYMBOL = "@@xmlMetadata";
} else {
  METADATA_SYMBOL = /* @__PURE__ */ Symbol("XML Node Metadata");
}
var XmlNode = class {
  constructor(tagname) {
    this.tagname = tagname;
    this.child = [];
    this[":@"] = /* @__PURE__ */ Object.create(null);
  }
  add(key, val) {
    if (key === "__proto__") key = "#__proto__";
    this.child.push({ [key]: val });
  }
  addChild(node, startIndex) {
    if (node.tagname === "__proto__") node.tagname = "#__proto__";
    if (node[":@"] && Object.keys(node[":@"]).length > 0) {
      this.child.push({ [node.tagname]: node.child, [":@"]: node[":@"] });
    } else {
      this.child.push({ [node.tagname]: node.child });
    }
    this.addStartIndex(startIndex);
  }
  addStartIndex(startIndex) {
    if (startIndex !== void 0) {
      this.child[this.child.length - 1][METADATA_SYMBOL] = { startIndex };
    }
  }
  addEndIndex(endIndex) {
    const lastChild = this.child[this.child.length - 1];
    if (lastChild !== void 0 && lastChild[METADATA_SYMBOL] !== void 0 && lastChild[METADATA_SYMBOL].endIndex === void 0) {
      lastChild[METADATA_SYMBOL].endIndex = endIndex;
    }
  }
  /** symbol used for metadata */
  static getMetaDataSymbol() {
    return METADATA_SYMBOL;
  }
};

// node_modules/xml-naming/src/index.js
var nameStartChar10 = ":A-Za-z_À-ÖØ-öø-˿Ͱ-ͽͿ-҆҈-῿‌-‍⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-�";
var nameChar10 = nameStartChar10 + "\\-\\.\\d·̀-ͯ‿-⁀";
var nameStartChar11 = ":A-Za-z_À-˿Ͱ-ͽͿ-҆҈-῿‌-‍⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-�𐀀-󯿿";
var nameChar11 = nameStartChar11 + "\\-\\.\\d·̀-ͯ҇‿-⁀";
var buildRegexes = (startChar, char, flags = "") => {
  const ncStart = startChar.replace(":", "");
  const ncChar = char.replace(":", "");
  const ncNamePat = `[${ncStart}][${ncChar}]*`;
  return {
    name: new RegExp(`^[${startChar}][${char}]*$`, flags),
    ncName: new RegExp(`^${ncNamePat}$`, flags),
    qName: new RegExp(`^${ncNamePat}(?::${ncNamePat})?$`, flags),
    nmToken: new RegExp(`^[${char}]+$`, flags),
    nmTokens: new RegExp(`^[${char}]+(?:\\s+[${char}]+)*$`, flags)
  };
};
var regexes10 = buildRegexes(nameStartChar10, nameChar10);
var regexes11 = buildRegexes(nameStartChar11, nameChar11, "u");
var nameStartCharAscii = ":A-Za-z_";
var nameCharAscii = nameStartCharAscii + "\\-\\.\\d";
var regexesAscii = buildRegexes(nameStartCharAscii, nameCharAscii);
var getRegexes = (xmlVersion = "1.0", asciiOnly = false) => {
  if (asciiOnly) return regexesAscii;
  return xmlVersion === "1.1" ? regexes11 : regexes10;
};
var qName = (str, { xmlVersion = "1.0", asciiOnly = false } = {}) => getRegexes(xmlVersion, asciiOnly).qName.test(str);

// node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js
var DocTypeReader = class {
  constructor(options, xmlVersion) {
    this.suppressValidationErr = !options;
    this.options = options;
    this.xmlVersion = xmlVersion || 1;
  }
  setXmlVersion(xmlVersion = 1) {
    this.xmlVersion = xmlVersion;
  }
  readDocType(xmlData, i2) {
    const entities = /* @__PURE__ */ Object.create(null);
    let entityCount = 0;
    if (xmlData[i2 + 3] === "O" && xmlData[i2 + 4] === "C" && xmlData[i2 + 5] === "T" && xmlData[i2 + 6] === "Y" && xmlData[i2 + 7] === "P" && xmlData[i2 + 8] === "E") {
      i2 = i2 + 9;
      let angleBracketsCount = 1;
      let hasBody = false, comment = false;
      let quoteChar = null;
      let exp2 = "";
      for (; i2 < xmlData.length; i2++) {
        if (quoteChar !== null) {
          if (xmlData[i2] === quoteChar) quoteChar = null;
          exp2 += xmlData[i2];
          continue;
        }
        if (!hasBody && !comment && (xmlData[i2] === '"' || xmlData[i2] === "'")) {
          quoteChar = xmlData[i2];
          exp2 += xmlData[i2];
          continue;
        }
        if (xmlData[i2] === "<" && !comment) {
          if (hasBody && hasSeq(xmlData, "!ENTITY", i2)) {
            i2 += 7;
            let entityName, val;
            [entityName, val, i2] = this.readEntityExp(xmlData, i2 + 1, this.suppressValidationErr);
            if (val.indexOf("&") === -1) {
              if (this.options.enabled !== false && this.options.maxEntityCount != null && entityCount >= this.options.maxEntityCount) {
                throw new Error(
                  `Entity count (${entityCount + 1}) exceeds maximum allowed (${this.options.maxEntityCount})`
                );
              }
              entities[entityName] = val;
              entityCount++;
            }
          } else if (hasBody && hasSeq(xmlData, "!ELEMENT", i2)) {
            i2 += 8;
            const { index } = this.readElementExp(xmlData, i2 + 1);
            i2 = index;
          } else if (hasBody && hasSeq(xmlData, "!ATTLIST", i2)) {
            i2 += 8;
          } else if (hasBody && hasSeq(xmlData, "!NOTATION", i2)) {
            i2 += 9;
            const { index } = this.readNotationExp(xmlData, i2 + 1, this.suppressValidationErr);
            i2 = index;
          } else if (hasSeq(xmlData, "!--", i2)) comment = true;
          else throw new Error(`Invalid DOCTYPE`);
          angleBracketsCount++;
          exp2 = "";
        } else if (xmlData[i2] === ">") {
          if (comment) {
            if (xmlData[i2 - 1] === "-" && xmlData[i2 - 2] === "-") {
              comment = false;
              angleBracketsCount--;
            }
          } else {
            angleBracketsCount--;
          }
          if (angleBracketsCount === 0) {
            break;
          }
        } else if (xmlData[i2] === "[") {
          hasBody = true;
        } else {
          exp2 += xmlData[i2];
        }
      }
      if (quoteChar !== null || angleBracketsCount !== 0) {
        throw new Error(`Unclosed DOCTYPE`);
      }
    } else {
      throw new Error(`Invalid Tag instead of DOCTYPE`);
    }
    return { entities, i: i2 };
  }
  readEntityExp(xmlData, i2) {
    i2 = skipWhitespace(xmlData, i2);
    const startIndex = i2;
    while (i2 < xmlData.length && !/\s/.test(xmlData[i2]) && xmlData[i2] !== '"' && xmlData[i2] !== "'") {
      i2++;
    }
    let entityName = xmlData.substring(startIndex, i2);
    validateEntityName2(entityName, { xmlVersion: this.xmlVersion });
    i2 = skipWhitespace(xmlData, i2);
    if (!this.suppressValidationErr) {
      if (xmlData.substring(i2, i2 + 6).toUpperCase() === "SYSTEM") {
        throw new Error("External entities are not supported");
      } else if (xmlData[i2] === "%") {
        throw new Error("Parameter entities are not supported");
      }
    }
    let entityValue = "";
    [i2, entityValue] = this.readIdentifierVal(xmlData, i2, "entity");
    if (this.options.enabled !== false && this.options.maxEntitySize != null && entityValue.length > this.options.maxEntitySize) {
      throw new Error(
        `Entity "${entityName}" size (${entityValue.length}) exceeds maximum allowed size (${this.options.maxEntitySize})`
      );
    }
    i2--;
    return [entityName, entityValue, i2];
  }
  readNotationExp(xmlData, i2) {
    i2 = skipWhitespace(xmlData, i2);
    const startIndex = i2;
    while (i2 < xmlData.length && !/\s/.test(xmlData[i2])) {
      i2++;
    }
    let notationName = xmlData.substring(startIndex, i2);
    !this.suppressValidationErr && validateEntityName2(notationName, { xmlVersion: this.xmlVersion });
    i2 = skipWhitespace(xmlData, i2);
    const identifierType = xmlData.substring(i2, i2 + 6).toUpperCase();
    if (!this.suppressValidationErr && identifierType !== "SYSTEM" && identifierType !== "PUBLIC") {
      throw new Error(`Expected SYSTEM or PUBLIC, found "${identifierType}"`);
    }
    i2 += identifierType.length;
    i2 = skipWhitespace(xmlData, i2);
    let publicIdentifier = null;
    let systemIdentifier = null;
    if (identifierType === "PUBLIC") {
      [i2, publicIdentifier] = this.readIdentifierVal(xmlData, i2, "publicIdentifier");
      i2 = skipWhitespace(xmlData, i2);
      if (xmlData[i2] === '"' || xmlData[i2] === "'") {
        [i2, systemIdentifier] = this.readIdentifierVal(xmlData, i2, "systemIdentifier");
      }
    } else if (identifierType === "SYSTEM") {
      [i2, systemIdentifier] = this.readIdentifierVal(xmlData, i2, "systemIdentifier");
      if (!this.suppressValidationErr && !systemIdentifier) {
        throw new Error("Missing mandatory system identifier for SYSTEM notation");
      }
    }
    return { notationName, publicIdentifier, systemIdentifier, index: --i2 };
  }
  readIdentifierVal(xmlData, i2, type) {
    let identifierVal = "";
    const startChar = xmlData[i2];
    if (startChar !== '"' && startChar !== "'") {
      throw new Error(`Expected quoted string, found "${startChar}"`);
    }
    i2++;
    const startIndex = i2;
    while (i2 < xmlData.length && xmlData[i2] !== startChar) {
      i2++;
    }
    identifierVal = xmlData.substring(startIndex, i2);
    if (xmlData[i2] !== startChar) {
      throw new Error(`Unterminated ${type} value`);
    }
    i2++;
    return [i2, identifierVal];
  }
  readElementExp(xmlData, i2) {
    i2 = skipWhitespace(xmlData, i2);
    const startIndex = i2;
    while (i2 < xmlData.length && !/\s/.test(xmlData[i2])) {
      i2++;
    }
    let elementName = xmlData.substring(startIndex, i2);
    if (!this.suppressValidationErr && !qName(elementName, { xmlVersion: this.xmlVersion })) {
      throw new Error(`Invalid element name: "${elementName}"`);
    }
    i2 = skipWhitespace(xmlData, i2);
    let contentModel = "";
    if (xmlData[i2] === "E" && hasSeq(xmlData, "MPTY", i2)) i2 += 4;
    else if (xmlData[i2] === "A" && hasSeq(xmlData, "NY", i2)) i2 += 2;
    else if (xmlData[i2] === "(") {
      i2++;
      const startIndex2 = i2;
      while (i2 < xmlData.length && xmlData[i2] !== ")") {
        i2++;
      }
      contentModel = xmlData.substring(startIndex2, i2);
      if (xmlData[i2] !== ")") {
        throw new Error("Unterminated content model");
      }
    } else if (!this.suppressValidationErr) {
      throw new Error(`Invalid Element Expression, found "${xmlData[i2]}"`);
    }
    return {
      elementName,
      contentModel: contentModel.trim(),
      index: i2
    };
  }
  readAttlistExp(xmlData, i2) {
    i2 = skipWhitespace(xmlData, i2);
    let startIndex = i2;
    while (i2 < xmlData.length && !/\s/.test(xmlData[i2])) {
      i2++;
    }
    let elementName = xmlData.substring(startIndex, i2);
    validateEntityName2(elementName, { xmlVersion: this.xmlVersion });
    i2 = skipWhitespace(xmlData, i2);
    startIndex = i2;
    while (i2 < xmlData.length && !/\s/.test(xmlData[i2])) {
      i2++;
    }
    let attributeName = xmlData.substring(startIndex, i2);
    if (!validateEntityName2(attributeName, { xmlVersion: this.xmlVersion })) {
      throw new Error(`Invalid attribute name: "${attributeName}"`);
    }
    i2 = skipWhitespace(xmlData, i2);
    let attributeType = "";
    if (xmlData.substring(i2, i2 + 8).toUpperCase() === "NOTATION") {
      attributeType = "NOTATION";
      i2 += 8;
      i2 = skipWhitespace(xmlData, i2);
      if (xmlData[i2] !== "(") {
        throw new Error(`Expected '(', found "${xmlData[i2]}"`);
      }
      i2++;
      let allowedNotations = [];
      while (i2 < xmlData.length && xmlData[i2] !== ")") {
        const startIndex2 = i2;
        while (i2 < xmlData.length && xmlData[i2] !== "|" && xmlData[i2] !== ")") {
          i2++;
        }
        let notation = xmlData.substring(startIndex2, i2);
        notation = notation.trim();
        if (!validateEntityName2(notation, { xmlVersion: this.xmlVersion })) {
          throw new Error(`Invalid notation name: "${notation}"`);
        }
        allowedNotations.push(notation);
        if (xmlData[i2] === "|") {
          i2++;
          i2 = skipWhitespace(xmlData, i2);
        }
      }
      if (xmlData[i2] !== ")") {
        throw new Error("Unterminated list of notations");
      }
      i2++;
      attributeType += " (" + allowedNotations.join("|") + ")";
    } else {
      const startIndex2 = i2;
      while (i2 < xmlData.length && !/\s/.test(xmlData[i2])) {
        i2++;
      }
      attributeType += xmlData.substring(startIndex2, i2);
      const validTypes = ["CDATA", "ID", "IDREF", "IDREFS", "ENTITY", "ENTITIES", "NMTOKEN", "NMTOKENS"];
      if (!this.suppressValidationErr && !validTypes.includes(attributeType.toUpperCase())) {
        throw new Error(`Invalid attribute type: "${attributeType}"`);
      }
    }
    i2 = skipWhitespace(xmlData, i2);
    let defaultValue = "";
    if (xmlData.substring(i2, i2 + 8).toUpperCase() === "#REQUIRED") {
      defaultValue = "#REQUIRED";
      i2 += 8;
    } else if (xmlData.substring(i2, i2 + 7).toUpperCase() === "#IMPLIED") {
      defaultValue = "#IMPLIED";
      i2 += 7;
    } else {
      [i2, defaultValue] = this.readIdentifierVal(xmlData, i2, "ATTLIST");
    }
    return {
      elementName,
      attributeName,
      attributeType,
      defaultValue,
      index: i2
    };
  }
};
var skipWhitespace = (data, index) => {
  while (index < data.length && /\s/.test(data[index])) {
    index++;
  }
  return index;
};
function hasSeq(data, seq, i2) {
  for (let j = 0; j < seq.length; j++) {
    if (seq[j] !== data[i2 + j + 1]) return false;
  }
  return true;
}
function validateEntityName2(name, xmlVersion) {
  if (qName(name, { xmlVersion }))
    return name;
  else
    throw new Error(`Invalid entity name ${name}`);
}

// node_modules/anynum/digitTable.js
var SCRIPT_ZEROS = [
  // Basic Latin (ASCII) — included for completeness / pass-through
  48,
  // 0-9
  // Arabic scripts
  1632,
  // Arabic-Indic ٠١٢٣٤٥٦٧٨٩
  1776,
  // Extended Arabic-Indic (Urdu/Persian/Sindhi) ۰۱۲۳
  // Indic scripts
  2406,
  // Devanagari ०१२३४५६७८९
  2534,
  // Bengali ০১২৩৪৫৬৭৮৯
  2662,
  // Gurmukhi ੦੧੨੩੪੫੬੭੮੯
  2790,
  // Gujarati ૦૧૨૩૪૫૬૭૮૯
  2918,
  // Odia ୦୧୨୩୪୫୬୭୮୯
  3046,
  // Tamil ௦௧௨௩௪௫௬௭௮௯
  3174,
  // Telugu ౦౧౨౩౪౫౬౭౮౯
  3302,
  // Kannada ೦೧೨೩೪೫೬೭೮೯
  3430,
  // Malayalam ൦൧൨൩൪൫൬൭൮൯
  3558,
  // Sinhala Archaic ෦෧෨෩෪෫෬෭෮෯
  // Southeast Asian scripts
  3664,
  // Thai ๐๑๒๓๔๕๖๗๘๙
  3792,
  // Lao ໐໑໒໓໔໕໖໗໘໙
  3872,
  // Tibetan ༠༡༢༣༤༥༦༧༨༩
  4160,
  // Myanmar ၀၁၂၃၄၅၆၇၈၉
  4240,
  // Myanmar Shan ႐႑႒႓႔႕႖႗႘႙
  6112,
  // Khmer ០១២៣៤៥៦៧៨៩
  6160,
  // Mongolian ᠐᠑᠒᠓᠔᠕᠖᠗᠘᠙
  6470,
  // Limbu ᥆᥇᥈᥉᥊᥋᥌᥍᥎᥏
  6608,
  // New Tai Lue ᧐᧑᧒᧓᧔᧕᧖᧗᧘᧙
  6784,
  // Tai Tham Hora ᪀᪁᪂᪃᪄᪅᪆᪇᪈᪉
  6800,
  // Tai Tham Tham ᪐᪑᪒᪓᪔᪕᪖᪗᪘᪙
  6992,
  // Balinese ᭐᭑᭒᭓᭔᭕᭖᭗᭘᭙
  7088,
  // Sundanese ᮰᮱᮲᮳᮴᮵᮶᮷᮸᮹
  7232,
  // Lepcha ᱀᱁᱂᱃᱄᱅᱆᱇᱈᱉
  7248,
  // Ol Chiki ᱐᱑᱒᱓᱔᱕᱖᱗᱘᱙
  // Fullwidth (CJK context)
  65296,
  // Fullwidth ０１２３４５６７８９
  // Mathematical digit variants (Unicode math block)
  120782,
  // Mathematical Bold
  120792,
  // Mathematical Double-Struck
  120802,
  // Mathematical Sans-Serif
  120812,
  // Mathematical Sans-Serif Bold
  120822,
  // Mathematical Monospace
  // Other scripts
  66720,
  // Osmanya 𐒠𐒡𐒢𐒣𐒤𐒥𐒦𐒧𐒨𐒩
  68912,
  // Hanifi Rohingya 𐴰𐴱𐴲𐴳𐴴𐴵𐴶𐴷𐴸𐴹
  69734,
  // Brahmi 𑁦𑁧𑁨𑁩𑁪𑁫𑁬𑁭𑁮𑁯
  69872,
  // Sora Sompeng 𑃰𑃱𑃲𑃳𑃴𑃵𑃶𑃷𑃸𑃹
  69942,
  // Chakma 𑄶𑄷𑄸𑄹𑄺𑄻𑄼𑄽𑄾𑄿
  70096,
  // Sharada 𑇐𑇑𑇒𑇓𑇔𑇕𑇖𑇗𑇘𑇙
  70384,
  // Khudawadi 𑋰𑋱𑋲𑋳𑋴𑋵𑋶𑋷𑋸𑋹
  70736,
  // Newa 𑑐𑑑𑑒𑑓𑑔𑑕𑑖𑑗𑑘𑑙
  70864,
  // Tirhuta 𑓐𑓑𑓒𑓓𑓔𑓕𑓖𑓗𑓘𑓙
  71248,
  // Modi 𑙐𑙑𑙒𑙓𑙔𑙕𑙖𑙗𑙘𑙙
  71360,
  // Takri 𑛀𑛁𑛂𑛃𑛄𑛅𑛆𑛇𑛈𑛉
  71472,
  // Ahom 𑜰𑜱𑜲𑜳𑜴𑜵𑜶𑜷𑜸𑜹
  71904,
  // Warang Citi 𑣠𑣡𑣢𑣣𑣤𑣥𑣦𑣧𑣨𑣩
  72016,
  // Dives Akuru 𑥐𑥑𑥒𑥓𑥔𑥕𑥖𑥗𑥘𑥙
  72688,
  // Khitan Small Script 𑯰𑯱𑯲𑯳𑯴𑯵𑯶𑯷𑯸𑯹
  72784,
  // Bhaiksuki 𑱐𑱑𑱒𑱓𑱔𑱕𑱖𑱗𑱘𑱙
  73040,
  // Masaram Gondi 𑵐𑵑𑵒𑵓𑵔𑵕𑵖𑵗𑵘𑵙
  73120,
  // Gunjala Gondi 𑶠𑶡𑶢𑶣𑶤𑶥𑶦𑶧𑶨𑶩
  73552,
  // Kawi 𑽐𑽑𑽒𑽓𑽔𑽕𑽖𑽗𑽘𑽙
  92768,
  // Mro 𖩠𖩡𖩢𖩣𖩤𖩥𖩦𖩧𖩨𖩩
  92864,
  // Tangsa 𖫀𖫁𖫂𖫃𖫄𖫅𖫆𖫇𖫈𖫉
  93008,
  // Pahawh Hmong 𖭐𖭑𖭒𖭓𖭔𖭕𖭖𖭗𖭘𖭙
  123200,
  // Nyiakeng Puachue Hmong 𞅀𞅁𞅂𞅃𞅄𞅅𞅆𞅇𞅈𞅉
  123632,
  // Wancho 𞋰𞋱𞋲𞋳𞋴𞋵𞋶𞋷𞋸𞋹
  124144,
  // Nag Mundari 𞓰𞓱𞓲𞓳𞓴𞓵𞓶𞓷𞓸𞓹
  125264,
  // Adlam 𞥐𞥑𞥒𞥓𞥔𞥕𞥖𞥗𞥘𞥙
  130032
  // Segmented digit symbols 🯰🯱🯲🯳🯴🯵🯶🯷🯸🯹
];
var NOT_DIGIT = 255;
var HIGH_MAP = /* @__PURE__ */ new Map();
var LOW_MAX = 65535;
var LOW_MIN = 1632;
var TABLE_OFFSET = LOW_MIN;
var TABLE_SIZE = LOW_MAX - LOW_MIN + 1;
var TABLE = new Uint8Array(TABLE_SIZE).fill(NOT_DIGIT);
for (const zero of SCRIPT_ZEROS) {
  for (let d = 0; d < 10; d++) {
    const cp = zero + d;
    if (cp <= LOW_MAX) {
      TABLE[cp - TABLE_OFFSET] = d;
    } else {
      HIGH_MAP.set(cp, d);
    }
  }
}

// node_modules/anynum/anynum.js
var CHAR_0 = 48;
var CHAR_9 = 57;
var CHAR_MINUS = 45;
var MINUS_SET = /* @__PURE__ */ new Set([8722, 65293, 65123]);
function anynum(str) {
  if (typeof str !== "string") return str;
  const len = str.length;
  if (len === 0) return str;
  let firstHit = -1;
  for (let i2 = 0; i2 < len; i2++) {
    const cc = str.charCodeAt(i2);
    if (cc >= CHAR_0 && cc <= CHAR_9 || cc === CHAR_MINUS) continue;
    if (cc < TABLE_OFFSET) {
      if (MINUS_SET.has(cc)) {
        firstHit = i2;
        break;
      }
      continue;
    }
    if (cc >= 55296 && cc <= 56319) {
      if (i2 + 1 < len) {
        const low = str.charCodeAt(i2 + 1);
        if (low >= 56320 && low <= 57343) {
          const cp = 65536 + (cc - 55296 << 10) + (low - 56320);
          if (HIGH_MAP.has(cp)) {
            firstHit = i2;
            break;
          }
        }
      }
      continue;
    }
    if (TABLE[cc - TABLE_OFFSET] !== NOT_DIGIT || MINUS_SET.has(cc)) {
      firstHit = i2;
      break;
    }
  }
  if (firstHit === -1) return str;
  const chars = [];
  if (firstHit > 0) chars.push(str.slice(0, firstHit));
  for (let i2 = firstHit; i2 < len; i2++) {
    const cc = str.charCodeAt(i2);
    if (cc >= CHAR_0 && cc <= CHAR_9 || cc === CHAR_MINUS) {
      chars.push(str[i2]);
      continue;
    }
    if (cc < TABLE_OFFSET) {
      chars.push(MINUS_SET.has(cc) ? "-" : str[i2]);
      continue;
    }
    if (cc >= 55296 && cc <= 56319) {
      if (i2 + 1 < len) {
        const low = str.charCodeAt(i2 + 1);
        if (low >= 56320 && low <= 57343) {
          const cp = 65536 + (cc - 55296 << 10) + (low - 56320);
          const d2 = HIGH_MAP.get(cp);
          if (d2 !== void 0) {
            chars.push(String.fromCharCode(d2 + 48));
            i2++;
            continue;
          }
        }
      }
      chars.push(str[i2]);
      continue;
    }
    if (MINUS_SET.has(cc)) {
      chars.push("-");
      continue;
    }
    const d = TABLE[cc - TABLE_OFFSET];
    chars.push(d !== NOT_DIGIT ? String.fromCharCode(d + 48) : str[i2]);
  }
  return chars.join("");
}
var anynum_default = anynum;

// node_modules/strnum/strnum.js
var hexRegex = /^[-+]?0x[a-fA-F0-9]+$/;
var binRegex = /^0b[01]+$/;
var octRegex = /^0o[0-7]+$/;
var numRegex = /^([\-\+])?(0*)([0-9]*(\.[0-9]*)?)$/;
var consider = {
  hex: true,
  binary: false,
  octal: false,
  leadingZeros: true,
  decimalPoint: ".",
  eNotation: true,
  //skipLike: /regex/,
  infinity: "original",
  // "null", "infinity" (Infinity type), "string" ("Infinity" (the string literal))
  unicode: false
};
function toNumber(str, options = {}) {
  options = Object.assign({}, consider, options);
  if (!str || typeof str !== "string") return str;
  let trimmedStr = str.trim();
  if (trimmedStr.length === 0) return str;
  else if (options.skipLike !== void 0 && options.skipLike.test(trimmedStr)) return str;
  else if (trimmedStr === "0") return 0;
  if (options.unicode) {
    trimmedStr = anynum_default(trimmedStr);
    if (trimmedStr === "0") return 0;
  }
  if (options.hex && hexRegex.test(trimmedStr)) {
    return parse_int(trimmedStr, 16);
  } else if (options.binary && binRegex.test(trimmedStr)) {
    return parse_int(trimmedStr, 2);
  } else if (options.octal && octRegex.test(trimmedStr)) {
    return parse_int(trimmedStr, 8);
  } else if (!isFinite(trimmedStr)) {
    const num = Number(trimmedStr);
    if (Number.isNaN(num)) return str;
    return handleInfinity(str, num, options);
  } else if (trimmedStr.includes("e") || trimmedStr.includes("E")) {
    return resolveEnotation(str, trimmedStr, options);
  } else {
    const match = numRegex.exec(trimmedStr);
    if (match) {
      const sign2 = match[1] || "";
      const leadingZeros = match[2];
      let numTrimmedByZeros = trimZeros(match[3]);
      const decimalAdjacentToLeadingZeros = sign2 ? (
        // 0., -00., 000.
        trimmedStr[leadingZeros.length + 1] === "."
      ) : trimmedStr[leadingZeros.length] === ".";
      if (!options.leadingZeros && (leadingZeros.length > 1 || leadingZeros.length === 1 && !decimalAdjacentToLeadingZeros)) {
        return str;
      } else {
        const num = Number(trimmedStr);
        const parsedStr = String(num);
        if (num === 0) return num;
        if (parsedStr.search(/[eE]/) !== -1) {
          if (options.eNotation) return num;
          else return str;
        } else if (trimmedStr.indexOf(".") !== -1) {
          if (parsedStr === "0") return num;
          else if (parsedStr === numTrimmedByZeros) return num;
          else if (parsedStr === `${sign2}${numTrimmedByZeros}`) return num;
          else return str;
        }
        let n = leadingZeros ? numTrimmedByZeros : trimmedStr;
        if (leadingZeros) {
          return n === parsedStr || sign2 + n === parsedStr ? num : str;
        } else {
          return n === parsedStr || n === sign2 + parsedStr ? num : str;
        }
      }
    } else {
      return str;
    }
  }
}
var eNotationRegx = /^([-+])?(0*)(\d*(\.\d*)?[eE][-\+]?\d+)$/;
function resolveEnotation(str, trimmedStr, options) {
  if (!options.eNotation) return str;
  const notation = trimmedStr.match(eNotationRegx);
  if (notation) {
    let sign2 = notation[1] || "";
    const eChar = notation[3].indexOf("e") === -1 ? "E" : "e";
    const leadingZeros = notation[2];
    const eAdjacentToLeadingZeros = sign2 ? (
      // 0E.
      trimmedStr[leadingZeros.length + 1] === eChar
    ) : trimmedStr[leadingZeros.length] === eChar;
    if (leadingZeros.length > 1 && eAdjacentToLeadingZeros) return str;
    else if (leadingZeros.length === 1 && (notation[3].startsWith(`.${eChar}`) || notation[3][0] === eChar)) {
      return Number(trimmedStr);
    } else if (leadingZeros.length > 0) {
      if (options.leadingZeros && !eAdjacentToLeadingZeros) {
        return Number(trimmedStr);
      } else return str;
    } else {
      return Number(trimmedStr);
    }
  } else {
    return str;
  }
}
function trimZeros(numStr) {
  if (numStr && numStr.indexOf(".") !== -1) {
    let end = numStr.length;
    while (end > 0 && numStr.charCodeAt(end - 1) === 48) end--;
    numStr = numStr.slice(0, end);
    if (numStr === ".") numStr = "0";
    else if (numStr[0] === ".") numStr = "0" + numStr;
    else if (numStr[numStr.length - 1] === ".") numStr = numStr.substring(0, numStr.length - 1);
    return numStr;
  }
  return numStr;
}
function parse_int(numStr, base) {
  const str = numStr.trim();
  if (base === 2 || base === 8) numStr = str.substring(2);
  if (parseInt) return parseInt(numStr, base);
  else if (Number.parseInt) return Number.parseInt(numStr, base);
  else if (window && window.parseInt) return window.parseInt(numStr, base);
  else throw new Error("parseInt, Number.parseInt, window.parseInt are not supported");
}
function handleInfinity(str, num, options) {
  const isPositive = num === Infinity;
  switch (options.infinity.toLowerCase()) {
    case "null":
      return null;
    case "infinity":
      return num;
    // Return Infinity or -Infinity
    case "string":
      return isPositive ? "Infinity" : "-Infinity";
    case "original":
    default:
      return str;
  }
}

// node_modules/fast-xml-parser/src/ignoreAttributes.js
function getIgnoreAttributesFn(ignoreAttributes) {
  if (typeof ignoreAttributes === "function") {
    return ignoreAttributes;
  }
  if (Array.isArray(ignoreAttributes)) {
    return (attrName) => {
      for (const pattern of ignoreAttributes) {
        if (typeof pattern === "string" && attrName === pattern) {
          return true;
        }
        if (pattern instanceof RegExp && pattern.test(attrName)) {
          return true;
        }
      }
    };
  }
  return () => false;
}

// node_modules/path-expression-matcher/src/Expression.js
var Expression = class {
  /**
   * Create a new Expression
   * @param {string} pattern - Pattern string (e.g., "root.users.user", "..user[id]")
   * @param {Object} options - Configuration options
   * @param {string} options.separator - Path separator (default: '.')
   */
  constructor(pattern, options = {}, data) {
    this.pattern = pattern;
    this.separator = options.separator || ".";
    this.segments = this._parse(pattern);
    this.data = data;
    this._hasDeepWildcard = this.segments.some((seg) => seg.type === "deep-wildcard");
    this._hasAttributeCondition = this.segments.some((seg) => seg.attrName !== void 0);
    this._hasPositionSelector = this.segments.some((seg) => seg.position !== void 0);
  }
  /**
   * Parse pattern string into segments
   * @private
   * @param {string} pattern - Pattern to parse
   * @returns {Array} Array of segment objects
   */
  _parse(pattern) {
    const segments = [];
    let i2 = 0;
    let currentPart = "";
    while (i2 < pattern.length) {
      if (pattern[i2] === this.separator) {
        if (i2 + 1 < pattern.length && pattern[i2 + 1] === this.separator) {
          if (currentPart.trim()) {
            segments.push(this._parseSegment(currentPart.trim()));
            currentPart = "";
          }
          segments.push({ type: "deep-wildcard" });
          i2 += 2;
        } else {
          if (currentPart.trim()) {
            segments.push(this._parseSegment(currentPart.trim()));
          }
          currentPart = "";
          i2++;
        }
      } else {
        currentPart += pattern[i2];
        i2++;
      }
    }
    if (currentPart.trim()) {
      segments.push(this._parseSegment(currentPart.trim()));
    }
    return segments;
  }
  /**
   * Parse a single segment
   * @private
   * @param {string} part - Segment string (e.g., "user", "ns::user", "user[id]", "ns::user:first")
   * @returns {Object} Segment object
   */
  _parseSegment(part) {
    const segment = { type: "tag" };
    let bracketContent = null;
    let withoutBrackets = part;
    const bracketMatch = part.match(/^([^\[]+)(\[[^\]]*\])(.*)$/);
    if (bracketMatch) {
      withoutBrackets = bracketMatch[1] + bracketMatch[3];
      if (bracketMatch[2]) {
        const content = bracketMatch[2].slice(1, -1);
        if (content) {
          bracketContent = content;
        }
      }
    }
    let namespace = void 0;
    let tagAndPosition = withoutBrackets;
    if (withoutBrackets.includes("::")) {
      const nsIndex = withoutBrackets.indexOf("::");
      namespace = withoutBrackets.substring(0, nsIndex).trim();
      tagAndPosition = withoutBrackets.substring(nsIndex + 2).trim();
      if (!namespace) {
        throw new Error(`Invalid namespace in pattern: ${part}`);
      }
    }
    let tag2 = void 0;
    let positionMatch = null;
    if (tagAndPosition.includes(":")) {
      const colonIndex = tagAndPosition.lastIndexOf(":");
      const tagPart = tagAndPosition.substring(0, colonIndex).trim();
      const posPart = tagAndPosition.substring(colonIndex + 1).trim();
      const isPositionKeyword = ["first", "last", "odd", "even"].includes(posPart) || /^nth\(\d+\)$/.test(posPart);
      if (isPositionKeyword) {
        tag2 = tagPart;
        positionMatch = posPart;
      } else {
        tag2 = tagAndPosition;
      }
    } else {
      tag2 = tagAndPosition;
    }
    if (!tag2) {
      throw new Error(`Invalid segment pattern: ${part}`);
    }
    segment.tag = tag2;
    if (namespace) {
      segment.namespace = namespace;
    }
    if (bracketContent) {
      if (bracketContent.includes("=")) {
        const eqIndex = bracketContent.indexOf("=");
        segment.attrName = bracketContent.substring(0, eqIndex).trim();
        segment.attrValue = bracketContent.substring(eqIndex + 1).trim();
      } else {
        segment.attrName = bracketContent.trim();
      }
    }
    if (positionMatch) {
      const nthMatch = positionMatch.match(/^nth\((\d+)\)$/);
      if (nthMatch) {
        segment.position = "nth";
        segment.positionValue = parseInt(nthMatch[1], 10);
      } else {
        segment.position = positionMatch;
      }
    }
    return segment;
  }
  /**
   * Get the number of segments
   * @returns {number}
   */
  get length() {
    return this.segments.length;
  }
  /**
   * Check if expression contains deep wildcard
   * @returns {boolean}
   */
  hasDeepWildcard() {
    return this._hasDeepWildcard;
  }
  /**
   * Check if expression has attribute conditions
   * @returns {boolean}
   */
  hasAttributeCondition() {
    return this._hasAttributeCondition;
  }
  /**
   * Check if expression has position selectors
   * @returns {boolean}
   */
  hasPositionSelector() {
    return this._hasPositionSelector;
  }
  /**
   * Get string representation
   * @returns {string}
   */
  toString() {
    return this.pattern;
  }
};

// node_modules/path-expression-matcher/src/ExpressionSet.js
var ExpressionSet = class {
  constructor() {
    this._byDepthAndTag = /* @__PURE__ */ new Map();
    this._wildcardByDepth = /* @__PURE__ */ new Map();
    this._deepWildcards = [];
    this._deepByTerminalTag = /* @__PURE__ */ new Map();
    this._patterns = /* @__PURE__ */ new Set();
    this._sealed = false;
  }
  /**
   * Add an Expression to the set.
   * Duplicate patterns (same pattern string) are silently ignored.
   *
   * @param {import('./Expression.js').default} expression - A pre-constructed Expression instance
   * @returns {this} for chaining
   * @throws {TypeError} if called after seal()
   *
   * @example
   * set.add(new Expression('root.users.user'));
   * set.add(new Expression('..script'));
   */
  add(expression) {
    if (this._sealed) {
      throw new TypeError(
        "ExpressionSet is sealed. Create a new ExpressionSet to add more expressions."
      );
    }
    if (this._patterns.has(expression.pattern)) return this;
    this._patterns.add(expression.pattern);
    if (expression.hasDeepWildcard()) {
      const lastSeg2 = expression.segments[expression.segments.length - 1];
      if (lastSeg2 && lastSeg2.type !== "deep-wildcard" && lastSeg2.tag !== "*") {
        const tag3 = lastSeg2.tag;
        if (!this._deepByTerminalTag.has(tag3)) this._deepByTerminalTag.set(tag3, []);
        this._deepByTerminalTag.get(tag3).push(expression);
      } else {
        this._deepWildcards.push(expression);
      }
      return this;
    }
    const depth = expression.length;
    const lastSeg = expression.segments[expression.segments.length - 1];
    const tag2 = lastSeg?.tag;
    if (!tag2 || tag2 === "*") {
      if (!this._wildcardByDepth.has(depth)) this._wildcardByDepth.set(depth, []);
      this._wildcardByDepth.get(depth).push(expression);
    } else {
      const key = `${depth}:${tag2}`;
      if (!this._byDepthAndTag.has(key)) this._byDepthAndTag.set(key, []);
      this._byDepthAndTag.get(key).push(expression);
    }
    return this;
  }
  /**
   * Add multiple expressions at once.
   *
   * @param {import('./Expression.js').default[]} expressions - Array of Expression instances
   * @returns {this} for chaining
   *
   * @example
   * set.addAll([
   *   new Expression('root.users.user'),
   *   new Expression('root.config.setting'),
   * ]);
   */
  addAll(expressions) {
    for (const expr of expressions) this.add(expr);
    return this;
  }
  /**
   * Check whether a pattern string is already present in the set.
   *
   * @param {import('./Expression.js').default} expression
   * @returns {boolean}
   */
  has(expression) {
    return this._patterns.has(expression.pattern);
  }
  /**
   * Number of expressions in the set.
   * @type {number}
   */
  get size() {
    return this._patterns.size;
  }
  /**
   * Seal the set against further modifications.
   * Useful to prevent accidental mutations after config is built.
   * Calling add() or addAll() on a sealed set throws a TypeError.
   *
   * @returns {this}
   */
  seal() {
    this._sealed = true;
    return this;
  }
  /**
   * Whether the set has been sealed.
   * @type {boolean}
   */
  get isSealed() {
    return this._sealed;
  }
  /**
   * Test whether the matcher's current path matches any expression in the set.
   *
   * Evaluation order (cheapest → most expensive):
   *  1. Exact depth + tag bucket  — O(1) lookup, typically 0–2 expressions
   *  2. Depth-only wildcard bucket — O(1) lookup, rare
   *  3. Deep-wildcard list         — always checked, but usually small
   *
   * @param {import('./Matcher.js').default} matcher - Matcher instance (or readOnly view)
   * @returns {boolean} true if any expression matches the current path
   *
   * @example
   * if (stopNodes.matchesAny(matcher)) {
   *   // handle stop node
   * }
   */
  matchesAny(matcher) {
    return this.findMatch(matcher) !== null;
  }
  /**
  * Find and return the first Expression that matches the matcher's current path.
  *
  * Uses the same evaluation order as matchesAny (cheapest → most expensive):
  *  1. Exact depth + tag bucket
  *  2. Depth-only wildcard bucket
  *  3. Deep-wildcard list
  *
  * @param {import('./Matcher.js').default} matcher - Matcher instance (or readOnly view)
  * @returns {import('./Expression.js').default | null} the first matching Expression, or null
  *
  * @example
  * const expr = stopNodes.findMatch(matcher);
  * if (expr) {
  *   // access expr.config, expr.pattern, etc.
  * }
  */
  findMatch(matcher) {
    const depth = matcher.getDepth();
    const tag2 = matcher.getCurrentTag();
    const exactKey = `${depth}:${tag2}`;
    const exactBucket = this._byDepthAndTag.get(exactKey);
    if (exactBucket) {
      for (let i2 = 0; i2 < exactBucket.length; i2++) {
        if (matcher.matches(exactBucket[i2])) return exactBucket[i2];
      }
    }
    const wildcardBucket = this._wildcardByDepth.get(depth);
    if (wildcardBucket) {
      for (let i2 = 0; i2 < wildcardBucket.length; i2++) {
        if (matcher.matches(wildcardBucket[i2])) return wildcardBucket[i2];
      }
    }
    const deepBucket = this._deepByTerminalTag.get(tag2);
    if (deepBucket) {
      for (let i2 = 0; i2 < deepBucket.length; i2++) {
        if (matcher.matches(deepBucket[i2])) return deepBucket[i2];
      }
    }
    for (let i2 = 0; i2 < this._deepWildcards.length; i2++) {
      if (matcher.matches(this._deepWildcards[i2])) return this._deepWildcards[i2];
    }
    return null;
  }
};

// node_modules/path-expression-matcher/src/Matcher.js
var MatcherView = class {
  /**
   * @param {Matcher} matcher - The parent Matcher instance to read from.
   */
  constructor(matcher) {
    this._matcher = matcher;
  }
  /**
   * Get the path separator used by the parent matcher.
   * @returns {string}
   */
  get separator() {
    return this._matcher.separator;
  }
  /**
   * Get current tag name.
   * @returns {string|undefined}
   */
  getCurrentTag() {
    const path6 = this._matcher.path;
    return path6.length > 0 ? path6[path6.length - 1].tag : void 0;
  }
  /**
   * Get current namespace.
   * @returns {string|undefined}
   */
  getCurrentNamespace() {
    const path6 = this._matcher.path;
    return path6.length > 0 ? path6[path6.length - 1].namespace : void 0;
  }
  /**
   * Get current node's attribute value.
   * @param {string} attrName
   * @returns {*}
   */
  getAttrValue(attrName) {
    const path6 = this._matcher.path;
    if (path6.length === 0) return void 0;
    return path6[path6.length - 1].values?.[attrName];
  }
  /**
   * Check if current node has an attribute.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAttr(attrName) {
    const path6 = this._matcher.path;
    if (path6.length === 0) return false;
    const current = path6[path6.length - 1];
    return current.values !== void 0 && attrName in current.values;
  }
  /**
   * Get the value of a "kept" attribute from the nearest ancestor (or
   * current node) that declared it via `push(tag, attrs, ns, { keep: [...] })`.
   * @param {string} attrName
   * @returns {*}
   */
  getAnyParentAttr(attrName) {
    return this._matcher.getAnyParentAttr(attrName);
  }
  /**
   * Check whether any ancestor (or the current node) kept the given
   * attribute via `push(tag, attrs, ns, { keep: [...] })`.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAnyParentAttr(attrName) {
    return this._matcher.hasAnyParentAttr(attrName);
  }
  /**
   * Get current node's sibling position (child index in parent).
   * @returns {number}
   */
  getPosition() {
    const path6 = this._matcher.path;
    if (path6.length === 0) return -1;
    return path6[path6.length - 1].position ?? 0;
  }
  /**
   * Get current node's repeat counter (occurrence count of this tag name).
   * @returns {number}
   */
  getCounter() {
    const path6 = this._matcher.path;
    if (path6.length === 0) return -1;
    return path6[path6.length - 1].counter ?? 0;
  }
  /**
   * Get current node's sibling index (alias for getPosition).
   * @returns {number}
   * @deprecated Use getPosition() or getCounter() instead
   */
  getIndex() {
    return this.getPosition();
  }
  /**
   * Get current path depth.
   * @returns {number}
   */
  getDepth() {
    return this._matcher.path.length;
  }
  /**
   * Get path as string.
   * @param {string} [separator] - Optional separator (uses default if not provided)
   * @param {boolean} [includeNamespace=true]
   * @returns {string}
   */
  toString(separator, includeNamespace = true) {
    return this._matcher.toString(separator, includeNamespace);
  }
  /**
   * Get path as array of tag names.
   * @returns {string[]}
   */
  toArray() {
    return this._matcher.path.map((n) => n.tag);
  }
  /**
   * Match current path against an Expression.
   * @param {Expression} expression
   * @returns {boolean}
   */
  matches(expression) {
    return this._matcher.matches(expression);
  }
  /**
   * Match any expression in the given set against the current path.
   * @param {ExpressionSet} exprSet
   * @returns {boolean}
   */
  matchesAny(exprSet) {
    return exprSet.matchesAny(this._matcher);
  }
};
var Matcher = class {
  /**
   * Create a new Matcher.
   * @param {Object} [options={}]
   * @param {string} [options.separator='.'] - Default path separator
   */
  constructor(options = {}) {
    this.separator = options.separator || ".";
    this.path = [];
    this.siblingStacks = [];
    this._pathStringCache = null;
    this._view = new MatcherView(this);
    this._keptAttrs = [];
  }
  /**
   * Push a new tag onto the path.
   * @param {string} tagName
   * @param {Object|null} [attrValues=null]
   * @param {string|null} [namespace=null]
   * @param {Object|null} [options=null]
   * @param {string[]} [options.keep] - Names of attributes (from attrValues)
   */
  push(tagName, attrValues = null, namespace = null, options = null) {
    this._pathStringCache = null;
    if (this.path.length > 0) {
      this.path[this.path.length - 1].values = void 0;
    }
    const currentLevel = this.path.length;
    let level = this.siblingStacks[currentLevel];
    if (!level) {
      level = { counts: /* @__PURE__ */ new Map(), total: 0 };
      this.siblingStacks[currentLevel] = level;
    }
    const siblingKey = namespace ? `${namespace}:${tagName}` : tagName;
    const counter = level.counts.get(siblingKey) || 0;
    const position = level.total;
    level.counts.set(siblingKey, counter + 1);
    level.total++;
    const node = {
      tag: tagName,
      position,
      counter
    };
    if (namespace !== null && namespace !== void 0) {
      node.namespace = namespace;
    }
    if (attrValues !== null && attrValues !== void 0) {
      node.values = attrValues;
    }
    this.path.push(node);
    const depth = this.path.length;
    const keep = options !== null ? options.keep : null;
    if (keep !== null && keep !== void 0 && keep.length > 0 && attrValues) {
      for (let i2 = 0; i2 < keep.length; i2++) {
        const name = keep[i2];
        if (attrValues[name] !== void 0) {
          this._keptAttrs.push({ depth, name, value: attrValues[name] });
        }
      }
    }
  }
  /**
   * Pop the last tag from the path.
   * @returns {Object|undefined} The popped node
   */
  pop() {
    if (this.path.length === 0) return void 0;
    this._pathStringCache = null;
    const node = this.path.pop();
    if (this.siblingStacks.length > this.path.length + 1) {
      this.siblingStacks.length = this.path.length + 1;
    }
    const poppedDepth = this.path.length + 1;
    while (this._keptAttrs.length > 0 && this._keptAttrs[this._keptAttrs.length - 1].depth >= poppedDepth) {
      this._keptAttrs.pop();
    }
    return node;
  }
  /**
   * Update current node's attribute values.
   * Useful when attributes are parsed after push.
   * @param {Object} attrValues
   */
  updateCurrent(attrValues) {
    if (this.path.length > 0) {
      const current = this.path[this.path.length - 1];
      if (attrValues !== null && attrValues !== void 0) {
        current.values = attrValues;
      }
    }
  }
  /**
   * Get current tag name.
   * @returns {string|undefined}
   */
  getCurrentTag() {
    return this.path.length > 0 ? this.path[this.path.length - 1].tag : void 0;
  }
  /**
   * Get current namespace.
   * @returns {string|undefined}
   */
  getCurrentNamespace() {
    return this.path.length > 0 ? this.path[this.path.length - 1].namespace : void 0;
  }
  /**
   * Get current node's attribute value.
   * @param {string} attrName
   * @returns {*}
   */
  getAttrValue(attrName) {
    if (this.path.length === 0) return void 0;
    return this.path[this.path.length - 1].values?.[attrName];
  }
  /**
   * Check if current node has an attribute.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAttr(attrName) {
    if (this.path.length === 0) return false;
    const current = this.path[this.path.length - 1];
    return current.values !== void 0 && attrName in current.values;
  }
  /**
   * Get the value of a "kept" attribute from the nearest ancestor (or
   * current node) that declared it via `push(tag, attrs, ns, { keep: [...] })`.
   * Unlike getAttrValue(), this works regardless of how deep the path has
   * gone since the attribute was pushed — but only for attribute names that
   * were explicitly marked with `keep` at push time. Cost is proportional to
   * the number of currently-kept attributes (typically 0-3), not path depth.
   * @param {string} attrName
   * @returns {*} the value, or undefined if no ancestor kept this attribute
   */
  getAnyParentAttr(attrName) {
    const kept = this._keptAttrs;
    for (let i2 = kept.length - 1; i2 >= 0; i2--) {
      if (kept[i2].name === attrName) return kept[i2].value;
    }
    return void 0;
  }
  /**
   * Check whether any ancestor (or the current node) kept the given
   * attribute via `push(tag, attrs, ns, { keep: [...] })`.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAnyParentAttr(attrName) {
    const kept = this._keptAttrs;
    for (let i2 = kept.length - 1; i2 >= 0; i2--) {
      if (kept[i2].name === attrName) return true;
    }
    return false;
  }
  /**
   * Get current node's sibling position (child index in parent).
   * @returns {number}
   */
  getPosition() {
    if (this.path.length === 0) return -1;
    return this.path[this.path.length - 1].position ?? 0;
  }
  /**
   * Get current node's repeat counter (occurrence count of this tag name).
   * @returns {number}
   */
  getCounter() {
    if (this.path.length === 0) return -1;
    return this.path[this.path.length - 1].counter ?? 0;
  }
  /**
   * Get current node's sibling index (alias for getPosition).
   * @returns {number}
   * @deprecated Use getPosition() or getCounter() instead
   */
  getIndex() {
    return this.getPosition();
  }
  /**
   * Get current path depth.
   * @returns {number}
   */
  getDepth() {
    return this.path.length;
  }
  /**
   * Get path as string.
   * @param {string} [separator] - Optional separator (uses default if not provided)
   * @param {boolean} [includeNamespace=true]
   * @returns {string}
   */
  toString(separator, includeNamespace = true) {
    const sep2 = separator || this.separator;
    const isDefault = sep2 === this.separator && includeNamespace === true;
    if (isDefault) {
      if (this._pathStringCache !== null) {
        return this._pathStringCache;
      }
      const result = this.path.map(
        (n) => n.namespace ? `${n.namespace}:${n.tag}` : n.tag
      ).join(sep2);
      this._pathStringCache = result;
      return result;
    }
    return this.path.map(
      (n) => includeNamespace && n.namespace ? `${n.namespace}:${n.tag}` : n.tag
    ).join(sep2);
  }
  /**
   * Get path as array of tag names.
   * @returns {string[]}
   */
  toArray() {
    return this.path.map((n) => n.tag);
  }
  /**
   * Reset the path to empty.
   */
  reset() {
    this._pathStringCache = null;
    this.path = [];
    this.siblingStacks = [];
    this._keptAttrs = [];
  }
  /**
   * Match current path against an Expression.
   * @param {Expression} expression
   * @returns {boolean}
   */
  matches(expression) {
    const segments = expression.segments;
    if (segments.length === 0) {
      return false;
    }
    if (expression.hasDeepWildcard()) {
      return this._matchWithDeepWildcard(segments);
    }
    return this._matchSimple(segments);
  }
  /**
   * @private
   */
  _matchSimple(segments) {
    if (this.path.length !== segments.length) {
      return false;
    }
    for (let i2 = 0; i2 < segments.length; i2++) {
      if (!this._matchSegment(segments[i2], this.path[i2], i2 === this.path.length - 1)) {
        return false;
      }
    }
    return true;
  }
  /**
   * @private
   */
  _matchWithDeepWildcard(segments) {
    let pathIdx = this.path.length - 1;
    let segIdx = segments.length - 1;
    while (segIdx >= 0 && pathIdx >= 0) {
      const segment = segments[segIdx];
      if (segment.type === "deep-wildcard") {
        segIdx--;
        if (segIdx < 0) {
          return true;
        }
        const nextSeg = segments[segIdx];
        let found = false;
        for (let i2 = pathIdx; i2 >= 0; i2--) {
          if (this._matchSegment(nextSeg, this.path[i2], i2 === this.path.length - 1)) {
            pathIdx = i2 - 1;
            segIdx--;
            found = true;
            break;
          }
        }
        if (!found) {
          return false;
        }
      } else {
        if (!this._matchSegment(segment, this.path[pathIdx], pathIdx === this.path.length - 1)) {
          return false;
        }
        pathIdx--;
        segIdx--;
      }
    }
    return segIdx < 0;
  }
  /**
   * @private
   */
  _matchSegment(segment, node, isCurrentNode) {
    if (segment.tag !== "*" && segment.tag !== node.tag) {
      return false;
    }
    if (segment.namespace !== void 0) {
      if (segment.namespace !== "*" && segment.namespace !== node.namespace) {
        return false;
      }
    }
    if (segment.attrName !== void 0) {
      if (!isCurrentNode) {
        return false;
      }
      if (!node.values || !(segment.attrName in node.values)) {
        return false;
      }
      if (segment.attrValue !== void 0) {
        if (String(node.values[segment.attrName]) !== String(segment.attrValue)) {
          return false;
        }
      }
    }
    if (segment.position !== void 0) {
      if (!isCurrentNode) {
        return false;
      }
      const counter = node.counter ?? 0;
      if (segment.position === "first" && counter !== 0) {
        return false;
      } else if (segment.position === "odd" && counter % 2 !== 1) {
        return false;
      } else if (segment.position === "even" && counter % 2 !== 0) {
        return false;
      } else if (segment.position === "nth" && counter !== segment.positionValue) {
        return false;
      }
    }
    return true;
  }
  /**
   * Match any expression in the given set against the current path.
   * @param {ExpressionSet} exprSet
   * @returns {boolean}
   */
  matchesAny(exprSet) {
    return exprSet.matchesAny(this);
  }
  /**
   * Create a snapshot of current state.
   * @returns {Object}
   */
  snapshot() {
    return {
      path: this.path.map((node) => ({ ...node })),
      siblingStacks: this.siblingStacks.map((level) => level ? { counts: new Map(level.counts), total: level.total } : level),
      keptAttrs: this._keptAttrs.map((entry) => ({ ...entry }))
    };
  }
  /**
   * Restore state from snapshot.
   * @param {Object} snapshot
   */
  restore(snapshot) {
    this._pathStringCache = null;
    this.path = snapshot.path.map((node) => ({ ...node }));
    this.siblingStacks = snapshot.siblingStacks.map((level) => level ? { counts: new Map(level.counts), total: level.total } : level);
    this._keptAttrs = (snapshot.keptAttrs || []).map((entry) => ({ ...entry }));
  }
  /**
   * Return the read-only {@link MatcherView} for this matcher.
   *
   * The same instance is returned on every call — no allocation occurs.
   * It always reflects the current parser state and is safe to pass to
   * user callbacks without risk of accidental mutation.
   *
   * @returns {MatcherView}
   *
   * @example
   * const view = matcher.readOnly();
   * // pass view to callbacks — it stays in sync automatically
   * view.matches(expr);       // ✓
   * view.getCurrentTag();     // ✓
   * // view.push(...)         // ✗ method does not exist — caught by TypeScript
   */
  readOnly() {
    return this._view;
  }
};

// node_modules/is-unsafe/src/contexts/html.js
var HTML_PATTERNS = [
  {
    id: "html-script-open",
    description: "<script opening tag",
    pattern: /<script[\s>/]/i
  },
  {
    id: "html-script-close",
    description: "</script closing tag",
    pattern: /<\/script[\s>]/i
  },
  {
    id: "html-javascript-protocol",
    description: "javascript: URI scheme (with optional whitespace/encoding)",
    // Handles j&#x61;vascript:, j\u0061vascript:, and whitespace variants
    pattern: /j[\t\n\r ]*a[\t\n\r ]*v[\t\n\r ]*a[\t\n\r ]*s[\t\n\r ]*c[\t\n\r ]*r[\t\n\r ]*i[\t\n\r ]*p[\t\n\r ]*t[\t\n\r ]*:/i
  },
  {
    id: "html-vbscript-protocol",
    description: "vbscript: URI scheme",
    pattern: /vbscript[\t\n\r ]*:/i
  },
  {
    id: "html-data-html",
    description: "data:text/html URI — can execute scripts in browsers",
    pattern: /data[\t\n\r ]*:[\t\n\r ]*text\/html/i
  },
  {
    id: "html-data-xhtml",
    description: "data:application/xhtml+xml URI",
    pattern: /data[\t\n\r ]*:[\t\n\r ]*application\/xhtml/i
  },
  {
    id: "html-data-svg",
    description: "data:image/svg+xml URI — can execute scripts",
    pattern: /data[\t\n\r ]*:[\t\n\r ]*image\/svg\+xml/i
  },
  {
    id: "html-inline-event-handler",
    description: "Inline event handler attributes: onclick=, onerror=, onload=, etc.",
    // \bon ensures we match a word boundary so "phonetic=" is not caught
    pattern: /\bon\w{1,30}\s*=/i
  },
  {
    id: "html-entity-obfuscated-script",
    description: "HTML-entity-encoded <script (e.g. &#x3C;script or &lt;script)",
    // Entities include optional trailing semicolon: &#x3C; or &#x3C (both valid in HTML5)
    pattern: /(?:&#x0*3[Cc];?|&#0*60;?|&lt;)\s*script/i
  },
  {
    id: "html-entity-obfuscated-javascript",
    description: 'HTML-entity-encoded javascript: (partial — catches common &#106; or &#x6a; for "j")',
    pattern: /(?:&#x0*6[Aa];?|&#0*106;?)\s*(?:&#x0*61;?|a)[\s\S]{0,80}script\s*:/i
  },
  {
    id: "html-style-expression",
    description: "CSS expression() — IE-era code execution in style attributes",
    pattern: /style[\s\S]{0,20}expression\s*\(/i
  },
  {
    id: "html-object-embed",
    description: "<object or <embed tags that can load active content",
    pattern: /<(?:object|embed)[\s>/]/i
  },
  {
    id: "html-base-tag",
    description: "<base href= — can hijack all relative URLs on a page",
    pattern: /<base[\s>]/i
  },
  {
    id: "html-meta-refresh",
    description: '<meta http-equiv="refresh" — can redirect users',
    pattern: /<meta[\s\S]{0,40}http-equiv[\s\S]{0,20}refresh/i
  },
  {
    id: "html-srcdoc",
    description: "srcdoc= attribute on iframes — embeds HTML that can run scripts",
    pattern: /srcdoc\s*=/i
  },
  {
    id: "html-iframe",
    description: "<iframe tag",
    pattern: /<iframe[\s>/]/i
  },
  {
    id: "html-form",
    description: "<form tag — can be used for phishing / credential harvesting injection",
    pattern: /<form[\s>/]/i
  }
];
var html_default = HTML_PATTERNS;

// node_modules/is-unsafe/src/contexts/xml.js
var XML_PATTERNS = [
  {
    id: "xml-cdata-injection",
    description: "CDATA section injection: <![CDATA[ breaks out of text node context",
    pattern: /<!\[CDATA\[/i
  },
  {
    id: "xml-cdata-close",
    description: "CDATA close sequence: ]]> can terminate an enclosing CDATA section",
    pattern: /\]\]>/
  },
  {
    id: "xml-processing-instruction",
    description: "XML processing instruction: <?xml-stylesheet or <?php etc.",
    pattern: /<\?(?:xml[\- ]|php|asp)/i
  },
  {
    id: "xml-doctype-injection",
    description: "DOCTYPE declaration embedded in content — can define entities",
    // Match <!DOCTYPE followed by end-of-string, whitespace, or [ (internal subset)
    pattern: /<!DOCTYPE(?:[\s[]|$)/i
  },
  {
    id: "xml-entity-system",
    description: "SYSTEM keyword — used in external entity declarations (XXE)",
    pattern: /\bSYSTEM\s+["']/i
  },
  {
    id: "xml-entity-public",
    description: "PUBLIC keyword — used in external entity declarations (XXE)",
    pattern: /\bPUBLIC\s+["']/i
  },
  {
    id: "xml-entity-declaration",
    description: "<!ENTITY declaration — defines entities, potential XXE or entity expansion",
    pattern: /<!ENTITY[\s%]/i
  },
  {
    id: "xml-billion-laughs",
    description: "Entity reference chaining / billion laughs: repeated &eX; style references",
    // Heuristic: 3+ consecutive entity refs suggests expansion attack
    pattern: /(?:&\w{1,20};){3,}/
  },
  {
    id: "xml-namespace-confusion",
    description: "xmlns: attribute injection — can redefine namespaces to confuse parsers",
    // pattern: /\bxmlns\s*(?::\w{1,40})?\s*=/i,
    pattern: /\bxmlns(?::\w{1,40})?\s*=/i
  },
  {
    id: "xml-comment-injection",
    description: "<!-- comment injection — can hide content from some parsers",
    pattern: /<!--/
  },
  {
    id: "xml-comment-close",
    description: "--> closes an enclosing XML comment",
    pattern: /-->/
  },
  {
    id: "xml-pi-close",
    description: "?> closes an enclosing processing instruction",
    pattern: /\?>/
  }
];
var xml_default = XML_PATTERNS;

// node_modules/is-unsafe/src/contexts/svg.js
var SVG_PATTERNS = [
  {
    id: "svg-script-element",
    description: "<script element inside SVG executes JavaScript",
    pattern: /<script[\s>/]/i
  },
  {
    id: "svg-xlink-href-javascript",
    description: "xlink:href with javascript: — classic SVG XSS via <a> or <use>",
    pattern: /xlink\s*:\s*href\s*=\s*["']?\s*javascript\s*:/i
  },
  {
    id: "svg-href-javascript",
    description: "href= with javascript: in SVG context (<a>, <animate>, etc.)",
    pattern: /href\s*=\s*["']?\s*javascript\s*:/i
  },
  {
    id: "svg-foreignobject",
    description: "<foreignObject embeds HTML inside SVG — can execute scripts",
    pattern: /<foreignObject[\s>/]/i
  },
  {
    id: "svg-use-external",
    description: "<use xlink:href or href pointing to external resource (non-fragment URL)",
    // Match <use with href= where the value starts with a non-# character (external URL)
    // [\"'][^#] catches quoted values not starting with #; [^\"'#\s>] catches unquoted
    pattern: /<use[\s\S]{0,60}(?:xlink\s*:\s*)?href\s*=\s*(?:["'][^#]|[^"'#\s>])/i
  },
  {
    id: "svg-animate-href",
    description: '<animate attributeName="href" — can dynamically change href to javascript:',
    pattern: /<animate[\s\S]{0,80}attributeName\s*=\s*["'][\s]*href["']/i
  },
  {
    id: "svg-animate-xlinkhref",
    description: '<animate attributeName="xlink:href"',
    pattern: /<animate[\s\S]{0,80}attributeName\s*=\s*["'][\s]*xlink\s*:\s*href["']/i
  },
  {
    id: "svg-set-javascript",
    description: '<set to="javascript:..." — sets an attribute to a javascript: URI',
    pattern: /<set[\s\S]{0,80}to\s*=\s*["']?\s*javascript\s*:/i
  },
  {
    id: "svg-event-handler",
    description: "SVG-specific event handler attributes: onload=, onerror=, onactivate=, etc.",
    pattern: /\bon(?:load|error|activate|begin|end|repeat|focus|blur|click|mouse\w{1,20}|key\w{1,20})\s*=/i
  },
  {
    id: "svg-handler-generic",
    description: "Generic on* handler catch-all for SVG attributes",
    pattern: /\bon\w{1,30}\s*=/i
  },
  {
    id: "svg-filter-feimage",
    description: "<feImage href= — filter primitive that can load external resources",
    pattern: /<feImage[\s\S]{0,80}(?:xlink\s*:\s*)?href\s*=/i
  },
  {
    id: "svg-image-external",
    description: "<image xlink:href with http/https or javascript protocol",
    pattern: /<image[\s\S]{0,80}(?:xlink\s*:\s*)?href\s*=\s*["']?\s*(?:https?|javascript)\s*:/i
  },
  {
    id: "svg-style-javascript",
    description: "style= attribute containing javascript: (e.g. background:url(javascript:...))",
    pattern: /style\s*=[\s\S]{0,60}javascript\s*:/i
  }
];
var svg_default = SVG_PATTERNS;

// node_modules/is-unsafe/src/contexts/sql.js
var SQL_PATTERNS = [
  {
    id: "sql-block-comment-open",
    description: "SQL block comment open: /* ... */ — unusual in legitimate user text",
    pattern: /\/\*/
  },
  {
    id: "sql-union-select",
    description: "UNION SELECT — most common SQL injection aggregation attack",
    pattern: /\bUNION\s{1,20}(?:ALL\s{1,20})?SELECT\b/i
  },
  {
    id: "sql-drop-table",
    description: "DROP TABLE — destructive DDL injection",
    pattern: /\bDROP\s{1,20}TABLE\b/i
  },
  {
    id: "sql-drop-database",
    description: "DROP DATABASE — destructive DDL injection",
    pattern: /\bDROP\s{1,20}DATABASE\b/i
  },
  {
    id: "sql-insert-into",
    description: "INSERT INTO — data injection",
    pattern: /\bINSERT\s{1,20}INTO\b/i
  },
  {
    id: "sql-delete-from",
    description: "DELETE FROM — data deletion injection",
    pattern: /\bDELETE\s{1,20}FROM\b/i
  },
  {
    id: "sql-update-set",
    description: "UPDATE ... SET — data modification injection",
    // Allows arbitrary content between UPDATE and SET (table name, alias, etc.)
    pattern: /\bUPDATE\b[\s\S]{1,60}\bSET\b/i
  },
  {
    id: "sql-exec-xp",
    description: "EXEC xp_ — MSSQL extended stored procedure execution",
    pattern: /\bEXEC(?:UTE)?\s{1,20}xp_/i
  },
  {
    id: "sql-tautology-string",
    description: `Classic string tautology: ' OR '1'='1 or " OR "1"="1"`,
    // Last quote is optional — injection may truncate it: ' OR '1'='1--
    pattern: /'\s{0,10}OR\s{0,10}'[^']{0,20}'\s*=\s*'[^']{0,20}/i
  },
  {
    id: "sql-tautology-numeric",
    description: "Numeric tautology: OR 1=1",
    pattern: /\bOR\s{1,10}1\s*=\s*1\b/i
  },
  {
    id: "sql-always-true-zero",
    description: "Numeric tautology: OR 0=0",
    pattern: /\bOR\s{1,10}0\s*=\s*0\b/i
  },
  {
    id: "sql-sleep-benchmark",
    description: "Time-based blind injection: SLEEP() or BENCHMARK()",
    pattern: /\b(?:SLEEP|BENCHMARK)\s*\(/i
  },
  {
    id: "sql-waitfor-delay",
    description: "MSSQL time-based blind injection: WAITFOR DELAY",
    pattern: /\bWAITFOR\s{1,20}DELAY\b/i
  },
  {
    id: "sql-char-function",
    description: "CHAR() function — used to obfuscate injected strings",
    pattern: /\bCHAR\s*\(\s*\d{1,3}/i
  },
  {
    id: "sql-information-schema",
    description: "INFORMATION_SCHEMA — reconnaissance query for table/column enumeration",
    pattern: /\bINFORMATION_SCHEMA\b/i
  }
];
var sql_default = SQL_PATTERNS;

// node_modules/is-unsafe/src/contexts/shell.js
var SHELL_PATTERNS = [
  {
    id: "shell-path-traversal-unix",
    description: "Unix path traversal: ../  — climbing the directory tree",
    pattern: /\.\.\//
  },
  {
    id: "shell-path-traversal-windows",
    description: "Windows path traversal: ..\\ — climbing the directory tree",
    pattern: /\.\.\\/
  },
  {
    id: "shell-path-traversal-encoded",
    description: "URL-encoded path traversal: %2e%2e or %2f variants",
    pattern: /%2e%2e|%2f\.\.|\.\.%2f/i
  },
  {
    id: "shell-null-byte",
    description: "Null byte injection: \\x00 or %00 — truncates strings in C-backed functions",
    pattern: /\x00|%00/
  },
  {
    id: "shell-semicolon",
    description: "Semicolon command separator: cmd1; cmd2",
    pattern: /;/
  },
  {
    id: "shell-pipe",
    description: "Pipe operator: cmd1 | cmd2",
    pattern: /\|/
  },
  {
    id: "shell-and-operator",
    description: "AND operator: cmd1 && cmd2",
    pattern: /&&/
  },
  {
    id: "shell-or-operator",
    description: "OR operator: cmd1 || cmd2",
    pattern: /\|\|/
  },
  {
    id: "shell-backtick",
    description: "Backtick command substitution: `cmd`",
    pattern: /`/
  },
  {
    id: "shell-dollar-paren",
    description: "Dollar-paren command substitution: $(cmd)",
    pattern: /\$\(/
  },
  {
    id: "shell-dollar-brace",
    description: "Dollar-brace variable expansion: ${var} — can be abused for injection",
    pattern: /\$\{/
  },
  {
    id: "shell-redirect-out",
    description: "Output redirection: cmd > file or cmd >> file",
    pattern: />{1,2}/
  },
  {
    id: "shell-redirect-in",
    description: "Input redirection: cmd < file",
    pattern: /</
  },
  {
    id: "shell-newline-injection",
    description: "Newline injection: \\n or \\r — can inject new shell commands",
    pattern: /[\n\r]/
  },
  {
    id: "shell-glob-star",
    description: "Glob expansion: * or ? — can expand to unintended files",
    // Only flag when combined with path separators to reduce false positives
    pattern: /[/\\][*?]/
  },
  {
    id: "shell-absolute-root",
    description: "Absolute root path injection: string starting with / or \\ (Windows UNC)",
    pattern: /^(?:\/|\\\\)/
  },
  {
    id: "shell-windows-drive",
    description: "Windows drive letter path injection: C:\\ or D:/",
    pattern: /^[a-zA-Z]:[/\\]/
  },
  {
    id: "shell-curl-wget",
    description: "curl/wget with URL or flags — can exfiltrate data or download payloads",
    // Require a URL scheme (http/https/ftp) or a flag (-) to reduce false positives
    // "curl is a tool" won't match; "curl http://..." or "curl -s ..." will
    pattern: /\b(?:curl|wget)\s+(?:https?:\/\/|ftp:\/\/|-)/i
  }
];
var shell_default = SHELL_PATTERNS;

// node_modules/is-unsafe/src/contexts/redos.js
var REDOS_PATTERNS = [
  {
    id: "redos-nested-quantifier-plus",
    description: "Nested + quantifier inside a group with outer quantifier: (a+)+, (.+b)*, etc.",
    // Matches any group containing a + quantifier, with an outer * or + — catches (a+)+, (.+b)*, etc.
    pattern: /\([^)]*\+[^)]*\)[+*]/
  },
  {
    id: "redos-nested-quantifier-star",
    description: "Nested * quantifier: (a*)* or (a*)+ — catastrophic backtracking",
    pattern: /\([^)]*\*[^)]*\)[*+]/
  },
  {
    id: "redos-nested-groups",
    description: "Doubly nested quantified groups: ((a+)+) — guaranteed catastrophic",
    pattern: /\(\([^)]{0,40}\)[+*]\)[+*]/
  },
  {
    id: "redos-alternation-overlap",
    description: "Overlapping alternation under quantifier: (a|a)+ — ambiguous NFA paths",
    // Detect repeated identical alternatives under a quantifier
    pattern: /\(([^|()]{1,20})\|(?:\1)(?:\|[^|()]{1,20}){0,5}\)[+*?]{1,2}/
  },
  {
    id: "redos-star-plus-concat",
    description: "(x*x)+ pattern — triggers super-linear backtracking",
    pattern: /\([^)]{0,10}\*[^)]{0,10}\)[+*]/
  },
  {
    id: "redos-dot-star-greedy",
    description: "(.*){n,} or (.+){n,} — repeated greedy dot quantifiers",
    pattern: /\(\.[*+]\)\{?\d/
  },
  {
    id: "redos-large-repetition",
    description: "Very large fixed or range repetition count {1000,} or {1000,n} — denial of service via backtracking",
    // Matches { followed by 4+ digits (≥1000), then optional ,digits }
    pattern: /\{\d{4,}(?:,\d*)?\}/
  },
  {
    id: "redos-catastrophic-alternation",
    description: "Long alternation with many similar branches — polynomial backtracking risk",
    // Heuristic: 10+ pipe-separated alternatives in a single group
    pattern: /\([^)]{0,200}(?:\|[^|)]{0,50}){9,}\)/
  }
];
var redos_default = REDOS_PATTERNS;

// node_modules/is-unsafe/src/contexts/nosql.js
var sep = `["'\\s]*:`;
var NOSQL_PATTERNS = [
  // ─── MongoDB $ operator injection ────────────────────────────────────────
  {
    id: "nosql-where-operator",
    description: "$where — executes arbitrary JavaScript server-side in MongoDB",
    pattern: new RegExp(`\\$where${sep}`, "i")
  },
  {
    id: "nosql-ne-operator",
    description: '$ne — "not equal" operator used to bypass equality checks',
    pattern: new RegExp(`\\$ne${sep}`, "i")
  },
  {
    id: "nosql-gt-operator",
    description: '$gt — "greater than" used to bypass password/value checks',
    pattern: new RegExp(`\\$gte?${sep}`, "i")
  },
  {
    id: "nosql-lt-operator",
    description: '$lt / $lte — "less than" bypass variants',
    pattern: new RegExp(`\\$lte?${sep}`, "i")
  },
  {
    id: "nosql-regex-operator",
    description: "$regex — can be used to extract data character by character (blind injection)",
    pattern: new RegExp(`\\$regex${sep}`, "i")
  },
  {
    id: "nosql-or-operator",
    description: "$or — logical OR; used to create always-true conditions",
    pattern: new RegExp(`\\$or${sep}\\s*\\[`, "i")
  },
  {
    id: "nosql-and-operator",
    description: "$and — logical AND operator injection",
    pattern: new RegExp(`\\$and${sep}\\s*\\[`, "i")
  },
  {
    id: "nosql-nor-operator",
    description: "$nor — logical NOR operator injection",
    pattern: new RegExp(`\\$nor${sep}\\s*\\[`, "i")
  },
  {
    id: "nosql-exists-operator",
    description: "$exists — can enumerate fields to determine schema",
    pattern: new RegExp(`\\$exists${sep}`, "i")
  },
  {
    id: "nosql-in-operator",
    description: "$in — matches any value in a list; can enumerate values",
    pattern: new RegExp(`\\$in${sep}\\s*\\[`, "i")
  },
  {
    id: "nosql-expr-operator",
    description: "$expr — allows aggregation expressions in queries (MongoDB 3.6+)",
    pattern: new RegExp(`\\$expr${sep}`, "i")
  },
  {
    id: "nosql-function-operator",
    description: "$function — executes arbitrary JavaScript in MongoDB 4.4+",
    pattern: new RegExp(`\\$function${sep}`, "i")
  },
  {
    id: "nosql-accumulator-operator",
    description: "$accumulator — custom aggregation with arbitrary JS execution",
    pattern: new RegExp(`\\$accumulator${sep}`, "i")
  },
  // ─── Prototype pollution ─────────────────────────────────────────────────
  {
    id: "nosql-proto-pollution",
    description: "__proto__ — prototype pollution via object key injection",
    pattern: /__proto__/
  },
  {
    id: "nosql-constructor-prototype",
    description: "constructor.prototype — alternative prototype pollution vector (dot notation or JSON key)",
    // Matches dot-notation (obj.constructor.prototype) and JSON key adjacency
    // ("constructor": {"prototype": ...})
    pattern: /constructor[\s"':.,{\[]*prototype/i
  },
  {
    id: "nosql-proto-bracket",
    description: '["__proto__"] — bracket-notation prototype pollution',
    pattern: /\[["']__proto__["']\]/
  }
];
var nosql_default = NOSQL_PATTERNS;

// node_modules/is-unsafe/src/contexts/log.js
var LOG_PATTERNS = [
  // ─── CRLF / newline injection ─────────────────────────────────────────────
  {
    id: "log-crlf-injection",
    description: "CRLF injection: literal \\r or \\n embeds fake log lines",
    pattern: /[\r\n]/
  },
  {
    id: "log-url-encoded-crlf",
    description: "URL-encoded CRLF: %0d, %0a, %0D, %0A — decoded by some log parsers",
    pattern: /%0[dDaA]/
  },
  {
    id: "log-unicode-newline",
    description: "Unicode newline variants: U+2028 (line separator), U+2029 (paragraph separator)",
    pattern: /[\u2028\u2029]/
  },
  // ─── Log4Shell / JNDI injection (CVE-2021-44228) ─────────────────────────
  {
    id: "log-log4shell-jndi",
    description: "Log4Shell: ${jndi:...} triggers remote code execution in Apache Log4j",
    pattern: /\$\{jndi\s*:/i
  },
  {
    id: "log-log4shell-obfuscated",
    description: "Obfuscated Log4Shell: ${::-j}... lookup-bypass prefix used to evade WAF detection",
    // ${::- is the Log4j lookup-bypass escape sequence; presence alone is suspicious
    pattern: /\$\{::-/
  },
  {
    id: "log-log4j-lookup",
    description: "Log4j lookup syntax: ${env:...}, ${sys:...}, ${ctx:...} — data exfiltration",
    pattern: /\$\{(?:env|sys|ctx|main|map|sd|web|docker|k8s|spring)\s*:/i
  },
  // ─── Server-Side Template Injection (SSTI) in log messages ───────────────
  {
    id: "log-ssti-double-brace",
    description: "SSTI double-brace: {{expression}} — Jinja2, Twig, Handlebars, etc.",
    pattern: /\{\{[\s\S]{0,80}\}\}/
  },
  {
    id: "log-ssti-hash-brace",
    description: "SSTI hash-brace: #{expression} — Thymeleaf, Velocity, Ruby ERB",
    pattern: /#\{[\s\S]{0,80}\}/
  },
  {
    id: "log-ssti-dollar-brace",
    description: "SSTI/EL injection: ${expression with operators or method calls} — JSP EL, Freemarker, SpEL",
    // Require that the ${...} content looks like an expression, not a plain variable name.
    // Flags if the content contains: . ( * + operators, or known SSTI keywords.
    // This avoids flagging ${PATH}, ${HOME} etc. (plain shell variables).
    pattern: /\$\{[^}]*(?:\.|\(|\*|\+|\bclass\b|\bruntime\b|\bprocess\b|\bexec\b)[^}]{0,80}\}/i
  },
  {
    id: "log-ssti-percent-tag",
    description: "SSTI ERB/ASP tag: <%= expression %> — Ruby ERB, ASP",
    pattern: /<%=[\s\S]{0,80}%>/
  },
  // ─── Null byte ────────────────────────────────────────────────────────────
  {
    id: "log-null-byte",
    description: "Null byte: \\x00 or %00 — can truncate log entries in C-backed loggers",
    pattern: /\x00|%00/
  },
  // ─── ANSI escape injection ────────────────────────────────────────────────
  {
    id: "log-ansi-escape",
    description: "ANSI escape sequence: ESC[ — can manipulate terminal output when logs are tailed",
    pattern: /\x1b\[/
  }
];
var log_default = LOG_PATTERNS;

// node_modules/is-unsafe/src/contexts/sql-strict.js
var SQL_STRICT_EXTRA = [
  {
    id: "sql-line-comment",
    description: "SQL line comment: -- followed by whitespace or end of string",
    pattern: /--(?:\s|$)/
  },
  {
    id: "sql-stacked-query",
    description: "Stacked queries: semicolon immediately followed by a SQL keyword",
    pattern: /;\s{0,10}(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b/i
  },
  {
    id: "sql-hex-encoding",
    description: "Hex-encoded string injection: 0x41414141 style (MySQL)",
    pattern: /\b0x[0-9a-f]{4,}/i
  }
];
var SQL_STRICT_PATTERNS = [...sql_default, ...SQL_STRICT_EXTRA];
var sql_strict_default = SQL_STRICT_PATTERNS;

// node_modules/is-unsafe/src/index.js
html_default.label = "HTML";
xml_default.label = "XML";
svg_default.label = "SVG";
sql_default.label = "SQL";
sql_strict_default.label = "SQL-STRICT";
shell_default.label = "SHELL";
redos_default.label = "REDOS";
nosql_default.label = "NOSQL";
log_default.label = "LOG";
var VALID_CONTEXTS = Object.freeze({
  HTML: html_default,
  XML: xml_default,
  SVG: svg_default,
  SQL: sql_default,
  "SQL-STRICT": sql_strict_default,
  SHELL: shell_default,
  REDOS: redos_default,
  NOSQL: nosql_default,
  LOG: log_default
});
function assertString(value) {
  if (typeof value !== "string") {
    throw new TypeError(
      `is-unsafe: first argument must be a string, got ${typeof value}`
    );
  }
}
function assertContext(context) {
  if (context instanceof RegExp) return;
  if (Array.isArray(context)) {
    if (context.length === 0) {
      throw new TypeError("is-unsafe: context must not be an empty array");
    }
    if (Array.isArray(context[0])) {
      for (const list of context) {
        if (!Array.isArray(list) || list.length === 0) {
          throw new TypeError(
            "is-unsafe: each context in the array must be a non-empty pattern array (PatternList)"
          );
        }
      }
    }
    return;
  }
  throw new TypeError(
    `is-unsafe: second argument must be a PatternList (e.g. HTML), an array of PatternLists (e.g. [HTML, XML]), or a RegExp. Got: ${typeof context}`
  );
}
function normalise(context) {
  if (context instanceof RegExp) return { lists: null, regex: context };
  if (Array.isArray(context[0])) return { lists: context, regex: null };
  return { lists: [context], regex: null };
}
function matchList(value, list) {
  const label = list.label ?? "CUSTOM";
  for (const rule of list) {
    if (rule.pattern.test(value)) {
      return { context: label, id: rule.id, description: rule.description, pattern: rule.pattern };
    }
  }
  return null;
}
function isUnsafe(value, context) {
  assertString(value);
  assertContext(context);
  const { lists, regex } = normalise(context);
  if (regex) return regex.test(value);
  for (const list of lists) {
    if (matchList(value, list) !== null) return true;
  }
  return false;
}

// node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js
function extractRawAttributes(prefixedAttrs, options) {
  if (!prefixedAttrs) return {};
  const attrs = options.attributesGroupName ? prefixedAttrs[options.attributesGroupName] : prefixedAttrs;
  if (!attrs) return {};
  const rawAttrs = {};
  for (const key in attrs) {
    if (key.startsWith(options.attributeNamePrefix)) {
      const rawName = key.substring(options.attributeNamePrefix.length);
      rawAttrs[rawName] = attrs[key];
    } else {
      rawAttrs[key] = attrs[key];
    }
  }
  return rawAttrs;
}
function extractNamespace(rawTagName) {
  if (!rawTagName || typeof rawTagName !== "string") return void 0;
  const colonIndex = rawTagName.indexOf(":");
  if (colonIndex !== -1 && colonIndex > 0) {
    const ns = rawTagName.substring(0, colonIndex);
    if (ns !== "xmlns") {
      return ns;
    }
  }
  return void 0;
}
var OrderedObjParser = class {
  constructor(options, externalEntities) {
    this.options = options;
    this.currentNode = null;
    this.tagsNodeStack = [];
    this.parseXml = parseXml;
    this.parseTextData = parseTextData;
    this.resolveNameSpace = resolveNameSpace;
    this.buildAttributesMap = buildAttributesMap;
    this.isItStopNode = isItStopNode;
    this.replaceEntitiesValue = replaceEntitiesValue;
    this.readStopNodeData = readStopNodeData;
    this.saveTextToParentTag = saveTextToParentTag;
    this.addChild = addChild;
    this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
    this.entityExpansionCount = 0;
    this.currentExpandedLength = 0;
    this.doctypefound = false;
    let namedEntities = { ...XML };
    if (this.options.entityDecoder) {
      this.entityDecoder = this.options.entityDecoder;
    } else {
      if (typeof this.options.htmlEntities === "object") namedEntities = this.options.htmlEntities;
      else if (this.options.htmlEntities === true) namedEntities = { ...COMMON_HTML, ...CURRENCY };
      this.entityDecoder = new EntityDecoder({
        namedEntities: { ...namedEntities, ...externalEntities },
        numericAllowed: this.options.htmlEntities,
        limit: {
          maxTotalExpansions: this.options.processEntities.maxTotalExpansions,
          maxExpandedLength: this.options.processEntities.maxExpandedLength,
          applyLimitsTo: this.options.processEntities.appliesTo
        },
        // onExternalEntity: (name, value) => isUnsafe(value) ? 'block' : 'allow',
        onInputEntity: (name, value) => (
          //TODO: VALID_CONTEXTS.HTML should be set only if this.options.htmlEntities
          isUnsafe(value, [html_default, xml_default]) ? ENTITY_ACTION.BLOCK : ENTITY_ACTION.ALLOW
        )
        //postCheck: resolved => resolved
      });
    }
    this.matcher = new Matcher();
    this.readonlyMatcher = this.matcher.readOnly();
    this.isCurrentNodeStopNode = false;
    this.stopNodeExpressionsSet = new ExpressionSet();
    const stopNodesOpts = this.options.stopNodes;
    if (stopNodesOpts && stopNodesOpts.length > 0) {
      for (let i2 = 0; i2 < stopNodesOpts.length; i2++) {
        const stopNodeExp = stopNodesOpts[i2];
        if (typeof stopNodeExp === "string") {
          this.stopNodeExpressionsSet.add(new Expression(stopNodeExp));
        } else if (stopNodeExp instanceof Expression) {
          this.stopNodeExpressionsSet.add(stopNodeExp);
        }
      }
      this.stopNodeExpressionsSet.seal();
    }
  }
};
function parseTextData(val, tagName, jPath, dontTrim, hasAttributes, isLeafNode, escapeEntities) {
  const options = this.options;
  if (val !== void 0) {
    if (options.trimValues && !dontTrim) {
      val = val.trim();
    }
    if (val.length > 0) {
      if (!escapeEntities) val = this.replaceEntitiesValue(val, tagName, jPath);
      const jPathOrMatcher = options.jPath ? jPath.toString() : jPath;
      const newval = options.tagValueProcessor(tagName, val, jPathOrMatcher, hasAttributes, isLeafNode);
      if (newval === null || newval === void 0) {
        return val;
      } else if (typeof newval !== typeof val || newval !== val) {
        return newval;
      } else if (options.trimValues) {
        return parseValue(val, options.parseTagValue, options.numberParseOptions);
      } else {
        const trimmedVal = val.trim();
        if (trimmedVal === val) {
          return parseValue(val, options.parseTagValue, options.numberParseOptions);
        } else {
          return val;
        }
      }
    }
  }
}
function resolveNameSpace(tagname) {
  if (this.options.removeNSPrefix) {
    const tags = tagname.split(":");
    const prefix = tagname.charAt(0) === "/" ? "/" : "";
    if (tags[0] === "xmlns") {
      return "";
    }
    if (tags.length === 2) {
      tagname = prefix + tags[1];
    }
  }
  return tagname;
}
var attrsRegx = new RegExp(`([^\\s=]+)\\s*(=\\s*(['"])([\\s\\S]*?)\\3)?`, "gm");
function buildAttributesMap(attrStr, jPath, tagName, force = false) {
  const options = this.options;
  if (force === true || options.ignoreAttributes !== true && typeof attrStr === "string") {
    const matches = getAllMatches(attrStr, attrsRegx);
    const len = matches.length;
    const attrs = {};
    const processedVals = new Array(len);
    let hasRawAttrs = false;
    const rawAttrsForMatcher = {};
    for (let i2 = 0; i2 < len; i2++) {
      const attrName = this.resolveNameSpace(matches[i2][1]);
      const oldVal = matches[i2][4];
      if (attrName.length && oldVal !== void 0) {
        let val = oldVal;
        if (options.trimValues) val = val.trim();
        val = this.replaceEntitiesValue(val, tagName, this.readonlyMatcher);
        processedVals[i2] = val;
        rawAttrsForMatcher[attrName] = val;
        hasRawAttrs = true;
      }
    }
    if (hasRawAttrs && typeof jPath === "object" && jPath.updateCurrent) {
      jPath.updateCurrent(rawAttrsForMatcher);
    }
    const jPathStr = options.jPath ? jPath.toString() : this.readonlyMatcher;
    let hasAttrs = false;
    for (let i2 = 0; i2 < len; i2++) {
      const attrName = this.resolveNameSpace(matches[i2][1]);
      if (this.ignoreAttributesFn(attrName, jPathStr)) continue;
      let aName = options.attributeNamePrefix + attrName;
      if (attrName.length) {
        if (options.transformAttributeName) {
          aName = options.transformAttributeName(aName);
        }
        aName = sanitizeName(aName, options);
        if (matches[i2][4] !== void 0) {
          const oldVal = processedVals[i2];
          const newVal = options.attributeValueProcessor(attrName, oldVal, jPathStr);
          if (newVal === null || newVal === void 0) {
            attrs[aName] = oldVal;
          } else if (typeof newVal !== typeof oldVal || newVal !== oldVal) {
            attrs[aName] = newVal;
          } else {
            attrs[aName] = parseValue(oldVal, options.parseAttributeValue, options.numberParseOptions);
          }
          hasAttrs = true;
        } else if (options.allowBooleanAttributes) {
          attrs[aName] = true;
          hasAttrs = true;
        }
      }
    }
    if (!hasAttrs) return;
    if (options.attributesGroupName && !options.preserveOrder) {
      const attrCollection = {};
      attrCollection[options.attributesGroupName] = attrs;
      return attrCollection;
    }
    return attrs;
  }
}
var parseXml = function(xmlData) {
  xmlData = xmlData.replace(/\r\n?/g, "\n");
  const xmlObj = new XmlNode("!xml");
  let currentNode = xmlObj;
  let textData = "";
  this.matcher.reset();
  this.entityDecoder.reset();
  this.entityExpansionCount = 0;
  this.currentExpandedLength = 0;
  this.doctypefound = false;
  const options = this.options;
  const docTypeReader = new DocTypeReader(options.processEntities);
  const xmlLen = xmlData.length;
  for (let i2 = 0; i2 < xmlLen; i2++) {
    const ch = xmlData[i2];
    if (ch === "<") {
      const c1 = xmlData.charCodeAt(i2 + 1);
      if (c1 === 47) {
        const closeIndex = findClosingIndex(xmlData, ">", i2, "Closing Tag is not closed.");
        let tagName = xmlData.substring(i2 + 2, closeIndex).trim();
        if (options.removeNSPrefix) {
          const colonIndex = tagName.indexOf(":");
          if (colonIndex !== -1) {
            tagName = tagName.substr(colonIndex + 1);
          }
        }
        tagName = transformTagName(options.transformTagName, tagName, "", options).tagName;
        if (currentNode) {
          textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
        }
        const lastTagName = this.matcher.getCurrentTag();
        if (tagName && options.unpairedTagsSet.has(tagName)) {
          throw new Error(`Unpaired tag can not be used as closing tag: </${tagName}>`);
        }
        if (lastTagName && options.unpairedTagsSet.has(lastTagName)) {
          this.matcher.pop();
          this.tagsNodeStack.pop();
        }
        this.matcher.pop();
        this.isCurrentNodeStopNode = false;
        currentNode = this.tagsNodeStack.pop() || xmlObj;
        if (options.captureMetaData && currentNode) {
          currentNode.addEndIndex(closeIndex + 1);
        }
        textData = "";
        i2 = closeIndex;
      } else if (c1 === 63) {
        let tagData = readTagExp(xmlData, i2, false, "?>");
        if (!tagData) throw new Error("Pi Tag is not closed.");
        textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
        const attsMap = this.buildAttributesMap(tagData.tagExp, this.matcher, tagData.tagName, true);
        if (attsMap) {
          const ver = attsMap[this.options.attributeNamePrefix + "version"];
          this.entityDecoder.setXmlVersion(Number(ver) || 1);
          docTypeReader.setXmlVersion(Number(ver) || 1);
        }
        if (options.ignoreDeclaration && tagData.tagName === "?xml" || options.ignorePiTags) {
        } else {
          const childNode = new XmlNode(tagData.tagName);
          childNode.add(options.textNodeName, "");
          if (tagData.tagName !== tagData.tagExp && tagData.attrExpPresent && options.ignoreAttributes !== true) {
            childNode[":@"] = attsMap;
          }
          this.addChild(currentNode, childNode, this.readonlyMatcher, i2);
          if (options.captureMetaData) {
            currentNode.addEndIndex(tagData.closeIndex + 2);
          }
        }
        i2 = tagData.closeIndex + 1;
      } else if (c1 === 33 && xmlData.charCodeAt(i2 + 2) === 45 && xmlData.charCodeAt(i2 + 3) === 45) {
        const endIndex = findClosingIndex(xmlData, "-->", i2 + 4, "Comment is not closed.");
        if (options.commentPropName) {
          const comment = xmlData.substring(i2 + 4, endIndex - 2);
          textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
          currentNode.add(options.commentPropName, [{ [options.textNodeName]: comment }]);
        }
        i2 = endIndex;
      } else if (c1 === 33 && xmlData.charCodeAt(i2 + 2) === 68) {
        if (this.doctypefound) throw new Error("Multiple DOCTYPE declarations found.");
        this.doctypefound = true;
        const result = docTypeReader.readDocType(xmlData, i2);
        this.entityDecoder.addInputEntities(result.entities);
        i2 = result.i;
      } else if (c1 === 33 && xmlData.charCodeAt(i2 + 2) === 91) {
        const closeIndex = findClosingIndex(xmlData, "]]>", i2, "CDATA is not closed.") - 2;
        const tagExp = xmlData.substring(i2 + 9, closeIndex);
        textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
        let val = this.parseTextData(tagExp, currentNode.tagname, this.readonlyMatcher, true, false, true, true);
        if (val == void 0) val = "";
        if (options.cdataPropName) {
          currentNode.add(options.cdataPropName, [{ [options.textNodeName]: tagExp }]);
        } else {
          currentNode.add(options.textNodeName, val);
        }
        i2 = closeIndex + 2;
      } else {
        let result = readTagExp(xmlData, i2, options.removeNSPrefix);
        if (!result) {
          const context = xmlData.substring(Math.max(0, i2 - 50), Math.min(xmlLen, i2 + 50));
          throw new Error(`readTagExp returned undefined at position ${i2}. Context: "${context}"`);
        }
        let tagName = result.tagName;
        const rawTagName = result.rawTagName;
        let tagExp = result.tagExp;
        let attrExpPresent = result.attrExpPresent;
        let closeIndex = result.closeIndex;
        ({ tagName, tagExp } = transformTagName(options.transformTagName, tagName, tagExp, options));
        if (options.strictReservedNames && (tagName === options.commentPropName || tagName === options.cdataPropName || tagName === options.textNodeName || tagName === options.attributesGroupName)) {
          throw new Error(`Invalid tag name: ${tagName}`);
        }
        if (currentNode && textData) {
          if (currentNode.tagname !== "!xml") {
            textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher, false);
          }
        }
        const lastTag = currentNode;
        if (lastTag && options.unpairedTagsSet.has(lastTag.tagname)) {
          currentNode = this.tagsNodeStack.pop();
          this.matcher.pop();
        }
        let isSelfClosing = false;
        if (tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1) {
          isSelfClosing = true;
          if (tagName[tagName.length - 1] === "/") {
            tagName = tagName.substr(0, tagName.length - 1);
            tagExp = tagName;
          } else {
            tagExp = tagExp.substr(0, tagExp.length - 1);
          }
          attrExpPresent = tagName !== tagExp;
        }
        let prefixedAttrs = null;
        let rawAttrs = {};
        let namespace = void 0;
        namespace = extractNamespace(rawTagName);
        if (tagName !== xmlObj.tagname) {
          this.matcher.push(tagName, {}, namespace);
        }
        if (tagName !== tagExp && attrExpPresent) {
          prefixedAttrs = this.buildAttributesMap(tagExp, this.matcher, tagName);
          if (prefixedAttrs) {
            rawAttrs = extractRawAttributes(prefixedAttrs, options);
          }
        }
        if (tagName !== xmlObj.tagname) {
          this.isCurrentNodeStopNode = this.isItStopNode();
        }
        const startIndex = i2;
        if (this.isCurrentNodeStopNode) {
          let tagContent = "";
          if (isSelfClosing) {
            i2 = result.closeIndex;
          } else if (options.unpairedTagsSet.has(tagName)) {
            i2 = result.closeIndex;
          } else {
            const result2 = this.readStopNodeData(xmlData, rawTagName, closeIndex + 1);
            if (!result2) throw new Error(`Unexpected end of ${rawTagName}`);
            i2 = result2.i;
            tagContent = result2.tagContent;
          }
          const childNode = new XmlNode(tagName);
          if (prefixedAttrs) {
            childNode[":@"] = prefixedAttrs;
          }
          childNode.add(options.textNodeName, tagContent);
          this.matcher.pop();
          this.isCurrentNodeStopNode = false;
          this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
          if (options.captureMetaData) {
            currentNode.addEndIndex(i2 + 1);
          }
        } else {
          if (isSelfClosing) {
            ({ tagName, tagExp } = transformTagName(options.transformTagName, tagName, tagExp, options));
            const childNode = new XmlNode(tagName);
            if (prefixedAttrs) {
              childNode[":@"] = prefixedAttrs;
            }
            this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
            if (options.captureMetaData) {
              currentNode.addEndIndex(closeIndex + 1);
            }
            this.matcher.pop();
            this.isCurrentNodeStopNode = false;
          } else if (options.unpairedTagsSet.has(tagName)) {
            const childNode = new XmlNode(tagName);
            if (prefixedAttrs) {
              childNode[":@"] = prefixedAttrs;
            }
            this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
            if (options.captureMetaData) {
              currentNode.addEndIndex(result.closeIndex + 1);
            }
            this.matcher.pop();
            this.isCurrentNodeStopNode = false;
            i2 = result.closeIndex;
            continue;
          } else {
            const childNode = new XmlNode(tagName);
            if (this.tagsNodeStack.length > options.maxNestedTags) {
              throw new Error("Maximum nested tags exceeded");
            }
            this.tagsNodeStack.push(currentNode);
            if (prefixedAttrs) {
              childNode[":@"] = prefixedAttrs;
            }
            this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
            currentNode = childNode;
          }
          textData = "";
          i2 = closeIndex;
        }
      }
    } else {
      textData += xmlData[i2];
    }
  }
  return xmlObj.child;
};
function addChild(currentNode, childNode, matcher, startIndex) {
  if (!this.options.captureMetaData) startIndex = void 0;
  const jPathOrMatcher = this.options.jPath ? matcher.toString() : matcher;
  const result = this.options.updateTag(childNode.tagname, jPathOrMatcher, childNode[":@"]);
  if (result === false) {
  } else if (typeof result === "string") {
    childNode.tagname = result;
    currentNode.addChild(childNode, startIndex);
  } else {
    currentNode.addChild(childNode, startIndex);
  }
}
function replaceEntitiesValue(val, tagName, jPath) {
  const entityConfig = this.options.processEntities;
  if (!entityConfig || !entityConfig.enabled) {
    return val;
  }
  if (entityConfig.allowedTags) {
    const jPathOrMatcher = this.options.jPath ? jPath.toString() : jPath;
    const allowed = Array.isArray(entityConfig.allowedTags) ? entityConfig.allowedTags.includes(tagName) : entityConfig.allowedTags(tagName, jPathOrMatcher);
    if (!allowed) {
      return val;
    }
  }
  if (entityConfig.tagFilter) {
    const jPathOrMatcher = this.options.jPath ? jPath.toString() : jPath;
    if (!entityConfig.tagFilter(tagName, jPathOrMatcher)) {
      return val;
    }
  }
  return this.entityDecoder.decode(val);
}
function saveTextToParentTag(textData, parentNode, matcher, isLeafNode) {
  if (textData) {
    if (isLeafNode === void 0) isLeafNode = parentNode.child.length === 0;
    textData = this.parseTextData(
      textData,
      parentNode.tagname,
      matcher,
      false,
      parentNode[":@"] ? Object.keys(parentNode[":@"]).length !== 0 : false,
      isLeafNode
    );
    if (textData !== void 0 && textData !== "")
      parentNode.add(this.options.textNodeName, textData);
    textData = "";
  }
  return textData;
}
function isItStopNode() {
  if (this.stopNodeExpressionsSet.size === 0) return false;
  return this.matcher.matchesAny(this.stopNodeExpressionsSet);
}
function tagExpWithClosingIndex(xmlData, i2, closingChar = ">") {
  let attrBoundary = 0;
  const len = xmlData.length;
  const closeCode0 = closingChar.charCodeAt(0);
  const closeCode1 = closingChar.length > 1 ? closingChar.charCodeAt(1) : -1;
  let result = "";
  let segmentStart = i2;
  for (let index = i2; index < len; index++) {
    const code = xmlData.charCodeAt(index);
    if (attrBoundary) {
      if (code === attrBoundary) attrBoundary = 0;
    } else if (code === 34 || code === 39) {
      attrBoundary = code;
    } else if (code === closeCode0) {
      if (closeCode1 !== -1) {
        if (xmlData.charCodeAt(index + 1) === closeCode1) {
          result += xmlData.substring(segmentStart, index);
          return { data: result, index };
        }
      } else {
        result += xmlData.substring(segmentStart, index);
        return { data: result, index };
      }
    } else if (code === 9 && !attrBoundary) {
      result += xmlData.substring(segmentStart, index) + " ";
      segmentStart = index + 1;
    }
  }
}
function findClosingIndex(xmlData, str, i2, errMsg) {
  const closingIndex = xmlData.indexOf(str, i2);
  if (closingIndex === -1) {
    throw new Error(errMsg);
  } else {
    return closingIndex + str.length - 1;
  }
}
function findClosingChar(xmlData, char, i2, errMsg) {
  const closingIndex = xmlData.indexOf(char, i2);
  if (closingIndex === -1) throw new Error(errMsg);
  return closingIndex;
}
function readTagExp(xmlData, i2, removeNSPrefix, closingChar = ">") {
  const result = tagExpWithClosingIndex(xmlData, i2 + 1, closingChar);
  if (!result) return;
  let tagExp = result.data;
  const closeIndex = result.index;
  const separatorIndex = tagExp.search(/\s/);
  let tagName = tagExp;
  let attrExpPresent = true;
  if (separatorIndex !== -1) {
    tagName = tagExp.substring(0, separatorIndex);
    tagExp = tagExp.substring(separatorIndex + 1).trimStart();
  }
  const rawTagName = tagName;
  if (removeNSPrefix) {
    const colonIndex = tagName.indexOf(":");
    if (colonIndex !== -1) {
      tagName = tagName.substr(colonIndex + 1);
      attrExpPresent = tagName !== result.data.substr(colonIndex + 1);
    }
  }
  return {
    tagName,
    tagExp,
    closeIndex,
    attrExpPresent,
    rawTagName
  };
}
function readStopNodeData(xmlData, tagName, i2) {
  const startIndex = i2;
  let openTagCount = 1;
  const xmllen = xmlData.length;
  for (; i2 < xmllen; i2++) {
    if (xmlData[i2] === "<") {
      const c1 = xmlData.charCodeAt(i2 + 1);
      if (c1 === 47) {
        const closeIndex = findClosingChar(xmlData, ">", i2, `${tagName} is not closed`);
        let closeTagName = xmlData.substring(i2 + 2, closeIndex).trim();
        if (closeTagName === tagName) {
          openTagCount--;
          if (openTagCount === 0) {
            return {
              tagContent: xmlData.substring(startIndex, i2),
              i: closeIndex
            };
          }
        }
        i2 = closeIndex;
      } else if (c1 === 63) {
        const closeIndex = findClosingIndex(xmlData, "?>", i2 + 1, "StopNode is not closed.");
        i2 = closeIndex;
      } else if (c1 === 33 && xmlData.charCodeAt(i2 + 2) === 45 && xmlData.charCodeAt(i2 + 3) === 45) {
        const closeIndex = findClosingIndex(xmlData, "-->", i2 + 3, "StopNode is not closed.");
        i2 = closeIndex;
      } else if (c1 === 33 && xmlData.charCodeAt(i2 + 2) === 91) {
        const closeIndex = findClosingIndex(xmlData, "]]>", i2, "StopNode is not closed.") - 2;
        i2 = closeIndex;
      } else {
        const tagData = readTagExp(xmlData, i2, false);
        if (tagData) {
          const openTagName = tagData && tagData.tagName;
          if (openTagName === tagName && tagData.tagExp[tagData.tagExp.length - 1] !== "/") {
            openTagCount++;
          }
          i2 = tagData.closeIndex;
        }
      }
    }
  }
}
function parseValue(val, shouldParse, options) {
  if (shouldParse && typeof val === "string") {
    const newval = val.trim();
    if (newval === "true") return true;
    else if (newval === "false") return false;
    else return toNumber(val, options);
  } else {
    if (isExist(val)) {
      return val;
    } else {
      return "";
    }
  }
}
function transformTagName(fn, tagName, tagExp, options) {
  if (fn) {
    const newTagName = fn(tagName);
    if (tagExp === tagName) {
      tagExp = newTagName;
    }
    tagName = newTagName;
  }
  tagName = sanitizeName(tagName, options);
  return { tagName, tagExp };
}
function sanitizeName(name, options) {
  if (criticalProperties.includes(name)) {
    throw new Error(`[SECURITY] Invalid name: "${name}" is a reserved JavaScript keyword that could cause prototype pollution`);
  } else if (DANGEROUS_PROPERTY_NAMES.includes(name)) {
    return options.onDangerousProperty(name);
  }
  return name;
}

// node_modules/fast-xml-parser/src/xmlparser/node2json.js
var METADATA_SYMBOL2 = XmlNode.getMetaDataSymbol();
function stripAttributePrefix(attrs, prefix) {
  if (!attrs || typeof attrs !== "object") return {};
  if (!prefix) return attrs;
  const rawAttrs = {};
  for (const key in attrs) {
    if (key.startsWith(prefix)) {
      const rawName = key.substring(prefix.length);
      rawAttrs[rawName] = attrs[key];
    } else {
      rawAttrs[key] = attrs[key];
    }
  }
  return rawAttrs;
}
function prettify(node, options, matcher, readonlyMatcher) {
  return compress(node, options, matcher, readonlyMatcher);
}
function compress(arr2, options, matcher, readonlyMatcher) {
  let text2;
  const compressedObj = {};
  for (let i2 = 0; i2 < arr2.length; i2++) {
    const tagObj = arr2[i2];
    const property = propName(tagObj);
    if (property !== void 0 && property !== options.textNodeName) {
      const rawAttrs = stripAttributePrefix(
        tagObj[":@"] || {},
        options.attributeNamePrefix
      );
      matcher.push(property, rawAttrs);
    }
    if (property === options.textNodeName) {
      if (text2 === void 0) text2 = tagObj[property];
      else text2 += "" + tagObj[property];
    } else if (property === void 0) {
      continue;
    } else if (tagObj[property]) {
      let val = compress(tagObj[property], options, matcher, readonlyMatcher);
      const isLeaf = isLeafTag(val, options);
      if (Object.keys(val).length === 0 && options.alwaysCreateTextNode) {
        val[options.textNodeName] = "";
      }
      if (tagObj[":@"]) {
        assignAttributes(val, tagObj[":@"], readonlyMatcher, options);
      } else if (Object.keys(val).length === 1 && val[options.textNodeName] !== void 0 && !options.alwaysCreateTextNode) {
        val = val[options.textNodeName];
      } else if (Object.keys(val).length === 0) {
        if (options.alwaysCreateTextNode) val[options.textNodeName] = "";
        else val = "";
      }
      if (tagObj[METADATA_SYMBOL2] !== void 0 && typeof val === "object" && val !== null) {
        val[METADATA_SYMBOL2] = tagObj[METADATA_SYMBOL2];
      }
      if (compressedObj[property] !== void 0 && Object.prototype.hasOwnProperty.call(compressedObj, property)) {
        if (!Array.isArray(compressedObj[property])) {
          compressedObj[property] = [compressedObj[property]];
        }
        compressedObj[property].push(val);
      } else {
        const jPathOrMatcher = options.jPath ? readonlyMatcher.toString() : readonlyMatcher;
        if (options.isArray(property, jPathOrMatcher, isLeaf)) {
          compressedObj[property] = [val];
        } else {
          compressedObj[property] = val;
        }
      }
      if (property !== void 0 && property !== options.textNodeName) {
        matcher.pop();
      }
    }
  }
  if (typeof text2 === "string") {
    if (text2.length > 0) compressedObj[options.textNodeName] = text2;
  } else if (text2 !== void 0) compressedObj[options.textNodeName] = text2;
  return compressedObj;
}
function propName(obj) {
  const keys = Object.keys(obj);
  for (let i2 = 0; i2 < keys.length; i2++) {
    const key = keys[i2];
    if (key !== ":@") return key;
  }
}
function assignAttributes(obj, attrMap, readonlyMatcher, options) {
  if (attrMap) {
    const keys = Object.keys(attrMap);
    const len = keys.length;
    for (let i2 = 0; i2 < len; i2++) {
      const atrrName = keys[i2];
      const rawAttrName = atrrName.startsWith(options.attributeNamePrefix) ? atrrName.substring(options.attributeNamePrefix.length) : atrrName;
      const jPathOrMatcher = options.jPath ? readonlyMatcher.toString() + "." + rawAttrName : readonlyMatcher;
      if (options.isArray(atrrName, jPathOrMatcher, true, true)) {
        obj[atrrName] = [attrMap[atrrName]];
      } else {
        obj[atrrName] = attrMap[atrrName];
      }
    }
  }
}
function isLeafTag(obj, options) {
  const { textNodeName } = options;
  const propCount = Object.keys(obj).length;
  if (propCount === 0) {
    return true;
  }
  if (propCount === 1 && (obj[textNodeName] || typeof obj[textNodeName] === "boolean" || obj[textNodeName] === 0)) {
    return true;
  }
  return false;
}

// node_modules/fast-xml-parser/src/xmlparser/XMLParser.js
var XMLParser = class {
  constructor(options) {
    this.externalEntities = {};
    this.options = buildOptions(options);
  }
  /**
   * Parse XML dats to JS object
   * @param {string|Uint8Array} xmlData
   * @param {boolean|Object} validationOption
   */
  parse(xmlData, validationOption) {
    if (typeof xmlData !== "string" && xmlData.toString) {
      if (xmlData instanceof Uint8Array && !(typeof Buffer !== "undefined" && Buffer.isBuffer(xmlData))) {
        xmlData = new TextDecoder("utf-8", { ignoreBOM: true }).decode(xmlData);
      } else {
        xmlData = xmlData.toString();
      }
    } else if (typeof xmlData !== "string") {
      throw new Error("XML data is accepted in String or Bytes[] form.");
    }
    if (validationOption) {
      if (validationOption === true) validationOption = {};
      const result = validate(xmlData, validationOption);
      if (result !== true) {
        throw Error(`${result.err.msg}:${result.err.line}:${result.err.col}`);
      }
    }
    const orderedObjParser = new OrderedObjParser(this.options, this.externalEntities);
    const orderedResult = orderedObjParser.parseXml(xmlData);
    if (this.options.preserveOrder || orderedResult === void 0) return orderedResult;
    else return prettify(orderedResult, this.options, orderedObjParser.matcher, orderedObjParser.readonlyMatcher);
  }
  /**
   * Add Entity which is not by default supported by this library
   * @param {string} key
   * @param {string} value
   */
  addEntity(key, value) {
    if (value.indexOf("&") !== -1) {
      throw new Error("Entity value can't have '&'");
    } else if (key.indexOf("&") !== -1 || key.indexOf(";") !== -1) {
      throw new Error("An entity must be set without '&' and ';'. Eg. use '#xD' for '&#xD;'");
    } else if (value === "&") {
      throw new Error("An entity with value '&' is not permitted");
    } else {
      this.externalEntities[key] = value;
    }
  }
  /**
   * Returns a Symbol that can be used to access the metadata
   * property on a node.
   *
   * If Symbol is not available in the environment, an ordinary property is used
   * and the name of the property is here returned.
   *
   * The XMLMetaData property is only present when `captureMetaData`
   * is true in the options.
   */
  static getMetaDataSymbol() {
    return XmlNode.getMetaDataSymbol();
  }
};

// node_modules/fast-xml-parser/src/fxp.js
var XMLValidator = {
  validate
};

// server/import/xlsx.mjs
import { createHash as createHash3 } from "node:crypto";
import path3 from "node:path";
var arr = (x2) => x2 == null ? [] : Array.isArray(x2) ? x2 : [x2];
var text = (x2) => x2 == null ? "" : typeof x2 === "object" ? String(x2["#text"] ?? "") : String(x2);
function readXlsx(buffer, { limits = {} } = {}) {
  const max3 = limits.expandedBytes ?? 100 * 1024 * 1024;
  if (buffer.length > 10 * 1024 * 1024) throw new Error("Excel文件超过10MiB");
  if (buffer[0] !== 80 || buffer[1] !== 75) throw new Error("无效Excel ZIP文件");
  const entries = /* @__PURE__ */ new Map();
  let total = 0, count = 0;
  const unzip = new Unzip((file) => {
    const name = file.name;
    if (++count > 2e4 || entries.has(name) || name.startsWith("/") || name.includes("\\") || name.split("/").includes("..")) throw new Error("ZIP条目无效或重复");
    if (file.originalSize > max3 - total) throw new Error("Excel解压数据超过限制");
    const chunks = [];
    entries.set(name, null);
    file.ondata = (error, data, final) => {
      if (error) throw new Error("Excel ZIP解压失败");
      total += data.length;
      if (total > max3) throw new Error("Excel解压数据超过限制");
      chunks.push(data);
      if (final) {
        const out = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
        let off = 0;
        for (const c of chunks) {
          out.set(c, off);
          off += c.length;
        }
        entries.set(name, out);
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    for (let i2 = 0; i2 < buffer.length; i2 += 65536) unzip.push(buffer.subarray(i2, i2 + 65536), i2 + 65536 >= buffer.length);
  } catch (e) {
    throw new Error(e.message.includes("限制") ? e.message : `Excel ZIP解析失败：${e.message}`);
  }
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, parseAttributeValue: false, trimValues: false, processEntities: false });
  const xml = (name) => {
    const bytes = entries.get(name);
    if (!bytes) throw new Error(`Excel缺少部件 ${name}`);
    const raw = strFromU8(bytes);
    if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw new Error("Excel不允许外部实体或DTD");
    if (XMLValidator.validate(raw) !== true) throw new Error(`Excel XML损坏 ${name}`);
    return parser.parse(raw);
  };
  if ([...entries.keys()].some((x2) => /vbaProject\.bin$/i.test(x2))) throw new Error("不支持宏Excel");
  const types = strFromU8(entries.get("[Content_Types].xml") ?? new Uint8Array());
  if (/macroEnabled/i.test(types)) throw new Error("不支持宏Excel");
  const book = xml("xl/workbook.xml").workbook;
  const relations = Object.fromEntries(arr(xml("xl/_rels/workbook.xml.rels").Relationships?.Relationship).map((r) => [r["@_Id"], r]));
  const strings = entries.has("xl/sharedStrings.xml") ? arr(xml("xl/sharedStrings.xml").sst?.si).map((si) => si.t !== void 0 ? text(si.t) : arr(si.r).map((r) => text(r.t)).join("")) : [];
  let inputRows = 0;
  const sheets = arr(book?.sheets?.sheet).map((sh) => {
    const rel = relations[sh["@_id"]];
    if (!rel || rel["@_TargetMode"] === "External") throw new Error("Excel工作表关系无效");
    const target = path3.posix.normalize(rel["@_Target"].startsWith("/") ? rel["@_Target"].slice(1) : "xl/" + rel["@_Target"]);
    if (!target.startsWith("xl/")) throw new Error("Excel工作表路径无效");
    const ws = xml(target).worksheet, cells = {};
    const rows = arr(ws?.sheetData?.row);
    inputRows += rows.length;
    if (inputRows > (limits.rows ?? 1e5)) throw new Error("Excel输入行超过100000行限制");
    for (const row of rows) for (const c of arr(row.c)) {
      const ref = c["@_r"];
      if (!/^[A-Z]{1,3}[1-9]\d{0,6}$/.test(ref ?? "") || cells[ref]) throw new Error("Excel单元格编号无效或重复");
      const t = c["@_t"];
      let value = null, kind = "number";
      if (c.f !== void 0) {
        kind = "formula";
        value = text(c.v);
      } else if (t === "s") {
        kind = "text";
        value = strings[Number(text(c.v))];
        if (value === void 0) throw new Error("Excel共享字符串索引无效");
      } else if (t === "inlineStr") {
        kind = "text";
        value = c.is?.t !== void 0 ? text(c.is.t) : arr(c.is?.r).map((r) => text(r.t)).join("");
      } else if (t === "str") {
        kind = "text";
        value = text(c.v);
      } else if (t === "d") {
        kind = "date";
        value = text(c.v);
      } else if (t === "b") {
        kind = "boolean";
        value = text(c.v);
      } else if (t === "e") {
        kind = "error";
        value = text(c.v);
      } else value = c.v === void 0 || text(c.v) === "" ? null : text(c.v);
      if (kind === "text" && value) value = value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
      cells[ref] = { ref, value, kind };
    }
    const relFile = path3.posix.dirname(target) + "/_rels/" + path3.posix.basename(target) + ".rels";
    let tables = [];
    if (entries.has(relFile)) {
      const rs = arr(xml(relFile).Relationships?.Relationship);
      for (const r of rs) if (/\/table$/.test(r["@_Type"] ?? "")) {
        if (r["@_TargetMode"] === "External") throw new Error("外部Excel表不支持");
        const tp = path3.posix.normalize(r["@_Target"].startsWith("/") ? r["@_Target"].slice(1) : path3.posix.dirname(target) + "/" + r["@_Target"]);
        if (!tp.startsWith("xl/")) throw new Error("Excel表路径无效");
        const tb = xml(tp).table;
        tables.push({ name: tb["@_name"] ?? tb["@_displayName"], ref: tb["@_ref"] });
      }
    }
    return { name: sh["@_name"], cells, tables };
  });
  if (new Set(sheets.map((s) => s.name)).size !== sheets.length) throw new Error("Excel工作表名称重复");
  return { epoch1904: ["1", "true"].includes(book?.workbookPr?.["@_date1904"]), hash: createHash3("sha256").update(buffer).digest("hex"), sheets };
}

// server/import/normalize.mjs
var FIX_HINTS = {
  SHEET_REQUIRED: "按标准模板补齐同名工作表，表名需完全一致。",
  TABLE_REQUIRED: "在指定工作表插入对应命名 Table，并核对表名拼写。",
  TABLE_INVALID: "重新选择该表的数据范围，确保范围有效。",
  INPUT_FORMULA: "原始输入填计算后的数值，不填公式。",
  INPUT_ERROR: "清除Excel错误值（如#N/A），填写有效数值。",
  NUMBER_INVALID: "填写有效数值；数量字段必须是整数。",
  VALUE_MISSING: "补录数值；确实没有时填明确的0或“不适用”，不能留空。",
  FIELD_REQUIRED: "在“订单信息”工作表补齐该字段名和值。",
  DATE_INVALID: "使用有效日期（yyyy-mm-dd 或 Excel 日期），且不超出订单覆盖区间。",
  VERSION_UNSUPPORTED: "成本表用 A-ORDER-0.2，每日表A4用 AB-TIME-0.2 开头。",
  DEMO_INVALID: "“是否模拟”只能填“是”或“否”。",
  OPENING_UNSUPPORTED: "首版期初加工/不良必须为0；非零期初需另立验收案例。",
  TAX_UNSUPPORTED: "税口径填写“模拟报价不拆税”。",
  ID_INVALID: "订单ID、子项ID、记录ID必填且不超过128字符。",
  BASIS_UNSUPPORTED: "时区填 Asia/Shanghai，收入口径填 生产等价。",
  DATE_RANGE: "生产覆盖开始不得晚于结束，且跨度不超过3660天。",
  WEIGHT_INVALID: "模拟标准重量必须大于0。",
  PARAM_DUPLICATE: "参数ID必须唯一，删除重复参数行。",
  PARAM_MISSING: "补齐成本计算表中的该参数行。",
  RATE_INVALID: "比例按小数填写（65%填0.65），取值在0到1之间。",
  RECIPE_INVALID: "原订单用量配方量合计必须大于0。",
  KEY_DUPLICATE: "材料编号或码号必须唯一。",
  QUANTITY_MISMATCH: "分码合同量合计必须等于订单合同数量。",
  ORDER_MISMATCH: "每日表的订单ID和核算子项ID必须与成本表一致。",
  STATUS_INVALID: "资料状态只能填 已确认/暂估/缺失/不适用/模拟确认。",
  VERSION_MISMATCH: "每日表的预期基线版本、数据修订版本必须与成本表一致。",
  SOURCE_REQUIRED: "来源字段必填，填写数据来源说明。",
  SIZE_UNKNOWN: "码号必须是分码合同量大于0的码号。",
  QUANTITY_INVALID: "当日不良量不能大于当日加工量。",
  DAY_STATUS_INVALID: "当日状态填 已报工/停产/待补录；停产时加工量和不良量都必须为0。",
  MATERIAL_UNKNOWN: "材料编号必须存在于原订单用量表中。",
  MATERIAL_BASIS: "材料口径填写 actual_net。",
  CATEGORY_INVALID: "成本类别只能使用 人工/制造/其他生产/管理/销售/财务。",
  METHOD_UNSUPPORTED: "首版计价方式填写“直接金额”。",
  SUPPLEMENT_BASIS: "计入规则必须以“已含”开头；补单不重复追加产量或成本。",
  SUPPLEMENT_LINK: "关联生产记录必须同日同码，且补产数量不超过当日加工量。",
  RECORD_DUPLICATE: "记录ID必须唯一，删除重复记录。",
  DAY_SIZE_DUPLICATE: "同一天同一码号只允许一条生产记录。",
  DAY_MISSING: "补齐该日该码生产记录；停产填停产且数量为0，未上报填待补录。",
  SUPPLEMENT_DIFFERENCE: "差异保留不自动补造；请核对不良与补单记录。",
  VERSION_REQUIRED: "预期基线版本和数据修订版本必填且不超过128字符。",
  SCOPE_INCOMPLETE: "补齐该日期的生产、材料或费用记录，或明确标记停产/不适用；不要用0代替缺失。"
};
function normalizePair(costBook, dailyBook) {
  const issues = [];
  const issue = (severity, code, sheet, cell, field, message, fileRole = "daily", recordId = null) => issues.push({ severity, code, fileRole, sheet, cell, field, recordId, message });
  const find = (book, name, role) => {
    const s = book.sheets.find((s2) => s2.name === name);
    if (!s) issue("error", "SHEET_REQUIRED", name, null, null, `缺少工作表“${name}”`, role);
    return s ?? { name, cells: {}, tables: [] };
  };
  const info = find(costBook, "订单信息", "cost"), cost = find(costBook, "成本计算", "cost"), orig = find(costBook, "原订单用量", "cost"), supp = find(costBook, "补单用量", "cost");
  const prod = find(dailyBook, "每日生产", "daily"), mat = find(dailyBook, "每日材料", "daily"), fee = find(dailyBook, "每日费用", "daily");
  const read = (sheet, ref, role = "daily") => {
    const c = sheet.cells[ref];
    if (c?.kind === "formula" || c?.kind === "error") {
      issue("error", c.kind === "formula" ? "INPUT_FORMULA" : "INPUT_ERROR", sheet.name, ref, null, "原始输入不能是公式或Excel错误值", role);
      return null;
    }
    return c?.value ?? null;
  };
  const num = (sheet, ref, { role = "daily", integer = false, required = true } = {}) => {
    let x2;
    try {
      x2 = decimal(read(sheet, ref, role));
      if (x2 !== null && integer && !new decimal_default(x2).isInteger()) throw new Error("数量必须为整数");
    } catch (e) {
      issue("error", "NUMBER_INVALID", sheet.name, ref, null, e.message, role);
      return null;
    }
    if (x2 === null && required) issue("missing", "VALUE_MISSING", sheet.name, ref, null, "数值待补齐", role);
    return x2;
  };
  const meta = {};
  for (const [ref, c] of Object.entries(info.cells)) if (/^A\d+$/.test(ref) && c.value) meta[c.value] = "B" + ref.slice(1);
  const mv = (k) => {
    const ref = meta[k];
    if (!ref) {
      issue("error", "FIELD_REQUIRED", info.name, null, k, `缺少字段“${k}”`, "cost");
      return null;
    }
    return read(info, ref, "cost");
  };
  const mn = (k, integer = false) => {
    mv(k);
    return num(info, meta[k] ?? "B0", { role: "cost", integer });
  };
  const md = (k) => {
    const x2 = mv(k);
    try {
      return excelDate(x2, costBook.epoch1904);
    } catch (e) {
      issue("error", "DATE_INVALID", info.name, meta[k], k, e.message, "cost");
      return null;
    }
  };
  const template = mv("模板版本");
  if (template !== "A-ORDER-0.2") issue("error", "VERSION_UNSUPPORTED", info.name, meta["模板版本"], "模板版本", "只支持A-ORDER-0.2", "cost");
  const demo = (value, sheet, cell, role) => {
    if (!["是", "否"].includes(value)) issue("error", "DEMO_INVALID", sheet.name, cell, null, "是否模拟必须明确为是或否", role);
    return value === "是";
  };
  if (!/^AB-TIME-0\.2(?:\s*\||$)/.test(read(prod, "A4") ?? "")) issue("error", "VERSION_UNSUPPORTED", prod.name, "A4", null, "每日表只支持AB-TIME-0.2");
  const order = { id: mv("订单ID"), lineId: mv("核算子项ID"), quantity: mn("合同数量", true), price: mn("核算报价"), weight: mn("模拟标准重量"), start: md("生产覆盖开始"), end: md("生产覆盖结束"), timezone: mv("时区"), isDemo: demo(mv("是否模拟"), info, meta["是否模拟"], "cost"), product: mv("产品"), customer: mv("客户代号"), taxBasis: mv("税口径"), incomeBasis: mv("收入口径"), opening: mn("期初加工/不良", true) };
  if (order.opening !== null && order.opening !== "0") issue("error", "OPENING_UNSUPPORTED", info.name, meta["期初加工/不良"], null, "首版仅支持完整周期零期初；非零期初需要配套收入和成本", "cost");
  if (order.taxBasis !== "模拟报价不拆税") issue("error", "TAX_UNSUPPORTED", info.name, meta["税口径"], null, "首版仅支持模拟报价不拆税", "cost");
  for (const key of ["id", "lineId"]) if (!order[key] || order[key].length > 128) issue("error", "ID_INVALID", info.name, null, key, "订单标识必填且不超过128字符", "cost");
  if (order.timezone !== "Asia/Shanghai" || order.incomeBasis !== "生产等价") issue("error", "BASIS_UNSUPPORTED", info.name, null, null, "首版只支持Asia/Shanghai和生产等价收入", "cost");
  if (order.start && order.end && (order.start > order.end || (new Date(order.end) - new Date(order.start)) / 864e5 > 3660)) issue("error", "DATE_RANGE", info.name, null, null, "日期范围须有序且不超过3660天", "cost");
  if (order.weight !== null && new decimal_default(order.weight).lte(0)) issue("error", "WEIGHT_INVALID", info.name, meta["模拟标准重量"], null, "标准重量必须大于0", "cost");
  const baseline = { id: mv("预期基线版本"), params: {}, recipe: [], sizePlan: [] }, revision = { id: mv("数据修订版本") };
  const source = (s, ref, role, id) => ({ fileRole: role, sheet: s.name, cell: ref, recordId: id, fileHash: (role === "cost" ? costBook : dailyBook).hash });
  const tableRows = (sheet, tableName, headerRow = 5, firstColumn = "A") => {
    const tb = sheet.tables?.find((t) => t.name === tableName);
    let last = 0, lo = 0, hi = 16384;
    if (!tb) {
      issue("error", "TABLE_REQUIRED", sheet.name, null, tableName, `缺少命名Table：${tableName}`, sheet === orig || sheet === cost || sheet === supp ? "cost" : "daily");
      return [];
    }
    if (tb) {
      const mm = tb.ref.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
      if (!mm) {
        issue("error", "TABLE_INVALID", sheet.name, null, null, "Excel表范围无效");
        return [];
      }
      headerRow = Number(mm[2]);
      last = Number(mm[4]);
      lo = columnIndex(mm[1]);
      hi = columnIndex(mm[3]);
    }
    const heads = {};
    for (const [ref, c] of Object.entries(sheet.cells)) {
      const mm = ref.match(/^([A-Z]+)(\d+)$/);
      if (Number(mm?.[2]) === headerRow && columnIndex(mm[1]) >= lo && columnIndex(mm[1]) <= hi && c.value) heads[c.value] = mm[1];
    }
    if (!last) {
      last = headerRow;
      while (sheet.cells[firstColumn + (last + 1)]?.value != null && sheet.cells[firstColumn + (last + 1)]?.value !== "") last++;
    }
    return Array.from({ length: Math.max(0, last - headerRow) }, (_, i2) => {
      const r = headerRow + i2 + 1;
      return { row: r, ref: (k) => (heads[k] ?? "??") + r, get: (k) => read(sheet, (heads[k] ?? "??") + r, sheet === orig || sheet === cost || sheet === supp ? "cost" : "daily") };
    });
  };
  for (const r of tableRows(cost, "CostParameters", 34)) {
    const id = r.get("参数ID");
    if (!id) continue;
    if (id in baseline.params) issue("error", "PARAM_DUPLICATE", cost.name, r.ref("参数ID"), id, "参数ID重复", "cost");
    baseline.params[id] = id === "price_change_date" ? r.get("输入值") : num(cost, r.ref("输入值"), { role: "cost" });
  }
  const needed = ["material_pct", "prep_piece", "press_piece", "production_mgmt", "energy_pct", "company_mgmt", "admin_pct", "logistics_piece", "production_loss_budget", "defect_loss_budget", "other_production_piece", "finance_piece"];
  for (const id of needed) if (!(id in baseline.params)) {
    baseline.params[id] = null;
    issue("missing", "PARAM_MISSING", cost.name, null, id, `缺少参数${id}`, "cost");
  }
  for (const [id, value] of Object.entries(baseline.params)) if (id.endsWith("_pct") || ["production_mgmt", "company_mgmt", "production_loss_budget", "defect_loss_budget"].includes(id)) {
    if (value !== null && new decimal_default(value).gt(1)) issue("error", "RATE_INVALID", cost.name, null, id, "比例应在0到1之间", "cost");
  }
  for (const r of tableRows(orig, "OriginalRecipe")) {
    const id = r.get("材料编号");
    if (!id) continue;
    baseline.recipe.push({ id, quantity: num(orig, r.ref("原表配方量kg"), { role: "cost" }), referencePrice: num(orig, r.ref("原表参考单价元/kg"), { role: "cost" }), source: source(orig, r.ref("材料编号"), "cost", id) });
  }
  for (const r of tableRows(orig, "OriginalSizePlan", 5, "K")) {
    const id = r.get("码号");
    if (!id) continue;
    baseline.sizePlan.push({ id, quantity: num(orig, r.ref("分码合同量 双"), { role: "cost", integer: true }), source: source(orig, r.ref("码号"), "cost", id) });
  }
  if (!baseline.recipe.length || baseline.recipe.every((m) => m.quantity === "0")) issue("error", "RECIPE_INVALID", orig.name, null, null, "配方总量必须大于0", "cost");
  for (const [items, key] of [[baseline.recipe, "材料编号"], [baseline.sizePlan, "码号"]]) if (new Set(items.map((x2) => x2.id)).size !== items.length) issue("error", "KEY_DUPLICATE", orig.name, null, key, `${key}重复`, "cost");
  if (order.quantity !== null && baseline.sizePlan.every((s) => s.quantity !== null) && !new decimal_default(order.quantity).eq(decimal_default.sum(...baseline.sizePlan.map((s) => s.quantity)))) issue("error", "QUANTITY_MISMATCH", orig.name, null, null, "分码合同数量与订单数量不一致", "cost");
  const common = (r, s, idKey = "记录ID", role = "daily") => {
    const x2 = { id: r.get(idKey), orderId: r.get("订单ID"), lineId: r.get("核算子项ID"), status: r.get("资料状态"), source: source(s, r.ref(idKey), role, r.get(idKey)) };
    if (!x2.id) issue("error", "ID_INVALID", s.name, r.ref(idKey), idKey, "记录ID必填", role);
    if (x2.orderId !== order.id || x2.lineId !== order.lineId) issue("error", "ORDER_MISMATCH", s.name, r.ref("订单ID"), null, "订单与子项跨文件不一致", role, x2.id);
    if (!STATUSES.includes(x2.status)) issue("error", "STATUS_INVALID", s.name, r.ref("资料状态"), null, "资料状态无效", role, x2.id);
    try {
      x2.date = excelDate(r.get(s === prod ? "生产日期" : "发生日期"), role === "cost" ? costBook.epoch1904 : dailyBook.epoch1904);
      if (x2.date < order.start || x2.date > order.end) throw new Error("记录日期超出覆盖区间");
    } catch (e) {
      x2.date = null;
      issue("error", "DATE_INVALID", s.name, r.ref("发生日期"), null, e.message, role, x2.id);
    }
    if (role === "daily") {
      if (r.get("预期基线版本") !== baseline.id || r.get("数据修订版本") !== revision.id) issue("error", "VERSION_MISMATCH", s.name, r.ref("预期基线版本"), null, "预期基线或修订版本跨文件不一致", "daily", x2.id);
      try {
        x2.availableAt = excelDate(r.get("数据可见时间"), dailyBook.epoch1904, true);
        if (x2.date && x2.availableAt.slice(0, 10) < x2.date) throw new Error("可见时间早于发生日期");
      } catch (e) {
        issue("error", "DATE_INVALID", s.name, r.ref("数据可见时间"), null, e.message, "daily", x2.id);
        x2.availableAt = null;
      }
      x2.isDemo = demo(r.get("是否模拟"), s, r.ref("是否模拟"), role);
      if (x2.isDemo !== order.isDemo) issue("error", "DEMO_MISMATCH", s.name, r.ref("是否模拟"), null, "模拟标记不一致", "daily", x2.id);
      if (!r.get("来源")) issue("error", "SOURCE_REQUIRED", s.name, r.ref("来源"), null, "来源必填", "daily", x2.id);
    } else x2.availableAt = x2.date + "T23:59:59+08:00";
    return x2;
  };
  const production = tableRows(prod, "DailyProductionCase").map((r) => {
    const x2 = { ...common(r, prod), size: r.get("码号"), processed: num(prod, r.ref("当日加工量"), { integer: true }), defects: num(prod, r.ref("当日不良量"), { integer: true }), dayStatus: r.get("当日状态") };
    if (!baseline.sizePlan.some((s) => s.id === x2.size && s.quantity !== "0")) issue("error", "SIZE_UNKNOWN", prod.name, r.ref("码号"), null, "未知或非生产码号", "daily", x2.id);
    if (x2.processed !== null && x2.defects !== null && new decimal_default(x2.defects).gt(x2.processed)) issue("error", "QUANTITY_INVALID", prod.name, r.ref("当日不良量"), null, "不良量不能大于加工量", "daily", x2.id);
    if (!["已报工", "停产", "待补录"].includes(x2.dayStatus) || x2.dayStatus === "停产" && (x2.processed !== "0" || x2.defects !== "0")) issue("error", "DAY_STATUS_INVALID", prod.name, r.ref("当日状态"), null, "停产数量应明确为0，或报工状态无效", "daily", x2.id);
    return x2;
  });
  const materials = tableRows(mat, "DailyMaterialCase").map((r) => {
    const x2 = { ...common(r, mat), materialId: r.get("材料编号"), net: num(mat, r.ref("实际净耗kg")), price: num(mat, r.ref("实际单价元/kg")) };
    if (!baseline.recipe.some((m) => m.id === x2.materialId)) issue("error", "MATERIAL_UNKNOWN", mat.name, r.ref("材料编号"), null, "未知材料", "daily", x2.id);
    if (r.get("材料口径") !== "actual_net") issue("error", "MATERIAL_BASIS", mat.name, r.ref("材料口径"), null, "实际材料必须为actual_net净耗口径", "daily", x2.id);
    return x2;
  });
  const expenses = tableRows(fee, "DailyExpenseCase").map((r) => {
    const x2 = { ...common(r, fee), category: r.get("成本类别"), item: r.get("费用项目"), amount: num(fee, r.ref("实际金额元")) };
    if (!CATEGORIES.includes(x2.category)) issue("error", "CATEGORY_INVALID", fee.name, r.ref("成本类别"), null, "费用类别无效", "daily", x2.id);
    if (r.get("计价方式") !== "直接金额") issue("error", "METHOD_UNSUPPORTED", fee.name, r.ref("计价方式"), null, "首版每日费用采用已归属直接金额", "daily", x2.id);
    return x2;
  });
  const supplements = tableRows(supp, "SupplementEvents").map((r) => {
    const x2 = { ...common(r, supp, "补单记录ID", "cost"), size: r.get("码号"), quantity: num(supp, r.ref("补产数量双"), { role: "cost", integer: true }), parentId: r.get("生产关联ID"), inclusion: r.get("计入规则"), reason: r.get("原因") };
    if (!x2.inclusion?.startsWith("已含")) issue("error", "SUPPLEMENT_BASIS", supp.name, r.ref("计入规则"), null, "首版只支持已含加工/净耗的补单", "cost", x2.id);
    const p = production.find((p2) => p2.id === x2.parentId);
    if (!p || p.date !== x2.date || p.size !== x2.size || x2.quantity !== null && p.processed !== null && new decimal_default(x2.quantity).gt(p.processed)) issue("error", "SUPPLEMENT_LINK", supp.name, r.ref("生产关联ID"), null, "补单关联生产记录无效", "cost", x2.id);
    return x2;
  });
  for (const list of [production, materials, expenses, supplements]) {
    const seen = /* @__PURE__ */ new Set();
    for (const x2 of list) {
      if (seen.has(x2.id)) issue("error", "RECORD_DUPLICATE", x2.source.sheet, x2.source.cell, null, "记录ID重复", x2.source.fileRole, x2.id);
      seen.add(x2.id);
    }
  }
  const pkeys = /* @__PURE__ */ new Set();
  for (const p of production) {
    const k = p.date + "|" + p.size;
    if (pkeys.has(k)) issue("error", "DAY_SIZE_DUPLICATE", prod.name, p.source.cell, null, "日码记录重复");
    pkeys.add(k);
  }
  if (order.start && order.end && order.start <= order.end && (new Date(order.end) - new Date(order.start)) / 864e5 <= 3660) {
    for (let day = order.start; day <= order.end; day = addDays(day, 1)) for (const sz of baseline.sizePlan.filter((s) => s.quantity !== null && new decimal_default(s.quantity).gt(0))) if (!pkeys.has(day + "|" + sz.id)) issue("missing", "DAY_MISSING", prod.name, null, day, `${day} ${sz.id}生产记录待补齐`);
  }
  const defectTotal = production.reduce((s, p) => s + Number(p.defects ?? 0), 0), suppTotal = supplements.reduce((s, p) => s + Number(p.quantity ?? 0), 0);
  if (defectTotal !== suppTotal) issue("warning", "SUPPLEMENT_DIFFERENCE", supp.name, null, null, `不良${defectTotal}双与补单${suppTotal}双不同；保留差异，不重复计入`, "cost");
  for (const name of [baseline.id, revision.id]) if (!name || name.length > 128) issue("error", "VERSION_REQUIRED", info.name, null, null, "基线与修订ID必填且不超过128字符", "cost");
  const dataset = { schemaVersion: SCHEMA_VERSION, order, baseline, revision, production, materials, expenses, supplements, sourceFiles: { cost: costBook.hash, daily: dailyBook.hash } };
  for (const issue2 of issues) issue2.hint = issue2.hint ?? FIX_HINTS[issue2.code] ?? "按提示修正后重新导入。";
  return { dataset, issues, summary: { orderId: order.id, lineId: order.lineId, baselineId: baseline.id, revisionId: revision.id, isDemo: order.isDemo, start: order.start, end: order.end, counts: { production: production.length, supplements: supplements.length, materials: materials.length, expenses: expenses.length } } };
}

// server/profit/trend.mjs
function trend(dataset, { start, end, baselineMode = "ideal", knownAt }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(end ?? "") || start > end || (new Date(end) - new Date(start)) / 864e5 > 3660) throw new Error("趋势日期范围无效");
  const points = [];
  for (let date2 = start; date2 <= end; date2 = addDays(date2, 1)) {
    const a = evaluate(dataset, { asOf: date2, baselineMode, knownAt });
    points.push({ date: date2, actual: a.cumulative.actual.gross, expected: a.cumulative.expected.gross, gap: a.cumulative.gap, quantity: a.cumulative.quantity, state: a.quality.state });
  }
  return points;
}

// server/http/uploads.mjs
var import_busboy = __toESM(require_lib(), 1);
function readUpload(req) {
  return new Promise((resolve, reject) => {
    let settled = false, total = 0;
    const files = {};
    let parser;
    const fail2 = (message, status = 400) => {
      if (settled) return;
      settled = true;
      req.unpipe(parser);
      req.resume();
      reject(Object.assign(new Error(message), { status }));
    };
    try {
      parser = (0, import_busboy.default)({ headers: req.headers, limits: { files: 2, fields: 0, parts: 3, fileSize: 10 * 1024 * 1024 } });
    } catch {
      fail2("请选择两份.xlsx文件");
      return;
    }
    req.on("data", (b) => {
      total += b.length;
      if (total > 25 * 1024 * 1024) fail2("上传请求超过25MiB", 413);
    });
    req.on("aborted", () => fail2("上传已中断"));
    req.on("error", () => fail2("上传读取失败"));
    parser.on("file", (name, stream, info) => {
      if (!["costFile", "dailyFile"].includes(name) || files[name] || !info.filename.toLowerCase().endsWith(".xlsx")) {
        stream.resume();
        fail2("文件字段重复、无效或不是.xlsx");
        return;
      }
      const chunks = [];
      files[name] = { name: info.filename, buffer: null };
      stream.on("data", (b) => {
        if (!settled) chunks.push(b);
      });
      stream.on("limit", () => fail2("单个Excel文件超过10MiB", 413));
      stream.on("error", () => fail2("文件上传失败"));
      stream.on("end", () => {
        if (!settled) files[name].buffer = Buffer.concat(chunks);
      });
    });
    for (const ev of ["filesLimit", "fieldsLimit", "partsLimit"]) parser.on(ev, () => fail2("只允许上传成本和每日两份Excel"));
    parser.on("error", () => fail2("上传格式损坏"));
    parser.on("close", () => {
      if (settled) return;
      if (!files.costFile?.buffer || !files.dailyFile?.buffer) {
        fail2("请同时选择成本Excel和每日Excel");
        return;
      }
      settled = true;
      resolve(files);
    });
    req.pipe(parser);
  });
}
async function readJson(req) {
  let total = 0;
  const chunks = [];
  for await (const b of req) {
    total += b.length;
    if (total > 65536) throw Object.assign(new Error("请求内容过大"), { status: 413 });
    chunks.push(b);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw Object.assign(new Error("JSON请求无效"), { status: 400 });
  }
}

// server/http/routes.mjs
var decTotal = (rows, key) => !rows.length ? null : rows.some((r) => r[key] == null) ? null : rows.reduce((s, r) => s.plus(r[key]), new D(0)).toString();
function previewStats(ds) {
  const processed = decTotal(ds.production, "processed"), defects = decTotal(ds.production, "defects");
  const good = processed !== null && defects !== null ? new D(processed).minus(defects).toString() : null;
  const prices = ds.materials.map((r) => r.price).filter((v) => v != null);
  return { production: { count: ds.production.length, processed, defects, good }, supplements: { count: ds.supplements.length, quantity: decTotal(ds.supplements, "quantity") }, materials: { count: ds.materials.length, net: decTotal(ds.materials, "net"), priceMin: prices.length ? prices.reduce((a, b) => new D(b).lt(a) ? b : a) : null, priceMax: prices.length ? prices.reduce((a, b) => new D(b).gt(a) ? b : a) : null }, expenses: { count: ds.expenses.length, amount: decTotal(ds.expenses, "amount"), byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, decTotal(ds.expenses.filter((r) => r.category === c), "amount")]).filter(([, v]) => v !== null)) } };
}
function createRoutes({ dataDir, clock = Date.now }) {
  const store = createStore(dataDir), token = randomBytes(24).toString("hex"), previews = /* @__PURE__ */ new Map();
  let busy = false;
  const repository = createMonitorRepository(path4.join(dataDir, "monitor-state"));
  const monitor = createMonitorService({ store, repository, clock });
  const send = (res, status, obj) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(obj));
  };
  return async (req, res, url) => {
    const prefix = "/api/import-v1";
    if (!url.pathname.startsWith(prefix + "/")) return false;
    try {
      const route = url.pathname.slice(prefix.length), parts = route.split("/").filter(Boolean).map(decodeURIComponent), host = req.headers.host ?? "";
      if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw Object.assign(new Error("只允许本机访问"), { status: 403 });
      if (req.method === "POST" && (req.headers.origin !== `http://${host}` || req.headers["x-qiying-token"] !== token)) throw Object.assign(new Error("请从本站页面提交，或刷新页面后重试"), { status: 403 });
      if (req.method === "GET" && route === "/session") {
        send(res, 200, { token, version: "import-v1", templateVersion: "A-ORDER-0.2", capabilities: ["monitor-scope-v3"] });
        return true;
      }
      if (req.method === "GET" && route === "/monitor") {
        send(res, 200, await monitor.create({ asOf: url.searchParams.get("asOf") || void 0, period: Number(url.searchParams.get("period") ?? 7), baselineMode: url.searchParams.get("baselineMode") ?? "ideal", knownAt: url.searchParams.get("knownAt") || void 0, customer: url.searchParams.get("customer") ?? "", status: url.searchParams.get("status") ?? "", risk: url.searchParams.get("risk") ?? "", search: url.searchParams.get("search") ?? "" }));
        return true;
      }
      if (req.method === "GET" && parts[0] === "monitor" && parts[1] === "views" && parts.length === 3) {
        send(res, 200, await monitor.get(parts[2]));
        return true;
      }
      if (req.method === "GET" && parts[0] === "monitor" && parts[1] === "views" && parts[3] === "snapshots" && parts[5] === "evidence" && parts.length === 6) {
        send(res, 200, await monitor.evidence(parts[2], parts[4]));
        return true;
      }
      if (req.method === "POST" && route === "/previews") {
        if (busy) throw Object.assign(new Error("正在解析另一份文件，请稍后重试"), { status: 429 });
        busy = true;
        try {
          for (const [id, p] of previews) if (clock() - p.at >= 6e5) previews.delete(id);
          if (previews.size >= 20) throw Object.assign(new Error("预览数量过多，请等待旧预览过期"), { status: 429 });
          const files = await readUpload(req);
          let result;
          try {
            result = normalizePair(readXlsx(files.costFile.buffer), readXlsx(files.dailyFile.buffer));
          } catch (e) {
            throw Object.assign(new Error(e.message), { status: 422 });
          }
          if (!result.issues.some((i2) => i2.severity === "error")) {
            const a = evaluate(result.dataset, { asOf: result.dataset.order.end });
            for (const m of a.quality.missing) result.issues.push({ severity: "missing", code: "SCOPE_INCOMPLETE", fileRole: "daily", sheet: m.field === "material" ? "每日材料" : m.field === "production" ? "每日生产" : "每日费用", cell: null, field: m.field, recordId: null, message: `${m.date} ${m.detail}`, hint: FIX_HINTS.SCOPE_INCOMPLETE });
          }
          const previewId = randomUUID5(), hash2 = digest(result.dataset);
          previews.set(previewId, { at: clock(), result, digest: hash2 });
          send(res, 200, { previewId, digest: hash2, summary: result.summary, issues: result.issues, previewStats: previewStats(result.dataset), canCommit: !result.issues.some((i2) => i2.severity === "error"), requiresIncomplete: result.issues.some((i2) => i2.severity === "missing"), preview: Object.fromEntries(["production", "materials", "expenses", "supplements"].map((k) => [k, result.dataset[k].slice(0, 200)])) });
        } finally {
          busy = false;
        }
        return true;
      }
      if (req.method === "POST" && parts[0] === "previews" && parts[2] === "commit" && parts.length === 3) {
        const p = previews.get(parts[1]);
        if (!p || clock() - p.at >= 6e5) throw Object.assign(new Error("预览已过期或服务已重启，请重新解析文件"), { status: 410 });
        const body = await readJson(req);
        if (body.digest !== p.digest) throw Object.assign(new Error("预览内容摘要不一致，请重新解析"), { status: 409 });
        if (p.result.issues.some((i2) => i2.severity === "error")) throw Object.assign(new Error("请先修正格式和业务校验错误"), { status: 422 });
        if (p.result.issues.some((i2) => i2.severity === "missing") && body.allowIncomplete !== true) throw Object.assign(new Error("资料不完整，请明确选择保存为待补齐版本"), { status: 422 });
        send(res, 200, await store.commit(p.result.dataset));
        return true;
      }
      if (req.method === "GET" && route === "/orders") {
        send(res, 200, { orders: await store.listOrders() });
        return true;
      }
      if (req.method === "GET" && route === "/portfolio") {
        const knownAt = url.searchParams.get("knownAt") || void 0;
        if (knownAt !== void 0 && (!Number.isFinite(Date.parse(knownAt)) || Date.parse(knownAt) > clock())) throw new Error("信息截止时间无效或晚于当前时间");
        let orders = await store.listOrders();
        if (knownAt) {
          const latest = /* @__PURE__ */ new Map();
          for (const v of await store.listVersions()) if (Date.parse(v.createdAt) <= Date.parse(knownAt)) latest.set(v.dataset.order.id, { ...v.dataset.order, revisionId: v.dataset.revision.id });
          orders = [...latest.values()];
        }
        const asOf = url.searchParams.get("asOf") ?? orders[0]?.start ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), baselineMode = url.searchParams.get("baselineMode") ?? "ideal";
        const rows = [];
        for (const order of orders) {
          const a = evaluate(await store.get(order.id, order.revisionId), { asOf, baselineMode, knownAt });
          rows.push({ order, cumulative: a.cumulative, quality: a.quality });
        }
        const known = rows.filter((r) => r.quality.state !== "not_started" && r.cumulative.actual.gross !== null), comparable = known.filter((r) => r.cumulative.expected.gross !== null);
        send(res, 200, { asOf, orders: rows, totals: { count: orders.length, known: known.length, comparable: comparable.length, excluded: orders.length - comparable.length, actualGross: known.length ? money(sum2(known.map((r) => r.cumulative.actual.gross))) : null, expectedGross: comparable.length ? money(sum2(comparable.map((r) => r.cumulative.expected.gross))) : null, gap: comparable.length ? money(sum2(comparable.map((r) => r.cumulative.gap))) : null } });
        return true;
      }
      if (req.method === "GET" && parts[0] === "orders" && parts.length === 3) {
        const id = parts[1], action = parts[2];
        if (action === "revisions") {
          send(res, 200, { revisions: await store.listRevisions(id) });
          return true;
        }
        const dataset = await store.get(id, url.searchParams.get("revision"));
        const knownAt = url.searchParams.get("knownAt") || void 0;
        if (knownAt !== void 0 && (!Number.isFinite(Date.parse(knownAt)) || Date.parse(knownAt) > clock())) throw new Error("信息截止时间无效或晚于当前时间");
        if (action === "analysis") {
          send(res, 200, evaluate(dataset, { asOf: url.searchParams.get("asOf") ?? dataset.order.start, baselineMode: url.searchParams.get("baselineMode") ?? "ideal", knownAt }));
          return true;
        }
        if (action === "trend") {
          send(res, 200, { points: trend(dataset, { start: url.searchParams.get("start") ?? dataset.order.start, end: url.searchParams.get("end") ?? dataset.order.end, baselineMode: url.searchParams.get("baselineMode") ?? "ideal", knownAt }) });
          return true;
        }
      }
      throw Object.assign(new Error("接口不存在"), { status: 404 });
    } catch (e) {
      req.resume();
      send(res, e.status ?? 400, { error: { message: e.message, code: e.status ?? "REQUEST_FAILED" } });
      return true;
    }
  };
}

// server/http/app.mjs
function createApp({ root, dataDir = path5.join(root, "data", "imports"), clock = Date.now }) {
  const dist = path5.join(root, "dist"), api = createRoutes({ dataDir, clock }), types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (await api(req, res, url)) return;
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      const name = decodeURIComponent(url.pathname) === "/" ? "/index.html" : decodeURIComponent(url.pathname), file = path5.resolve(dist, "." + name), relative = path5.relative(dist, file);
      if (relative.startsWith("..") || path5.isAbsolute(relative)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const content = await readFile3(file);
      res.writeHead(200, { "Content-Type": types[path5.extname(file)] || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end(req.method === "HEAD" ? void 0 : content);
    } catch (e) {
      res.writeHead(e.code === "ENOENT" || e.code === "EISDIR" ? 404 : 400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("页面不存在或请求无效");
    }
  });
}
export {
  createApp
};
