"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.iconSvg = iconSvg;
exports.iconPng = iconPng;
/** Feather icons (react-icons/fi) as inline SVG or PNG, by name: "FiLayers", "FiBookmark", … */
const Fi = __importStar(require("react-icons/fi"));
const react_1 = require("react");
const server_1 = require("react-dom/server");
const sharp_1 = __importDefault(require("sharp"));
const table = Fi;
function component(name) {
    const c = table[name];
    if (!c)
        throw new Error(`Unknown icon "${name}". Use a Feather name from react-icons/fi, e.g. FiLayers, FiFolder, FiGithub.`);
    return c;
}
/** Inline SVG markup, sized by CSS. */
function iconSvg(name, hex) {
    return (0, server_1.renderToStaticMarkup)((0, react_1.createElement)(component(name), { color: hex, size: "100%" }));
}
/** base64 PNG data in the form pptxgenjs expects. */
async function iconPng(name, hex) {
    const svg = (0, server_1.renderToStaticMarkup)((0, react_1.createElement)(component(name), { color: hex, size: 256 }));
    const buf = await (0, sharp_1.default)(Buffer.from(svg)).resize(512, 512).png().toBuffer();
    return "image/png;base64," + buf.toString("base64");
}
