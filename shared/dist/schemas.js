"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameActionSchema = exports.JoinRoomSchema = exports.CreateRoomSchema = void 0;
const zod_1 = require("zod");
exports.CreateRoomSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "İsim gerekli").max(20, "İsim çok uzun"),
    avatar: zod_1.z.string().optional(),
    frameId: zod_1.z.string().optional(),
    gameMode: zod_1.z.enum(['standard', '101']).optional().default('standard')
});
exports.JoinRoomSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, "Oda kodu gerekli"),
    name: zod_1.z.string().min(1, "İsim gerekli").max(20, "İsim çok uzun"),
    avatar: zod_1.z.string().optional(),
    frameId: zod_1.z.string().optional()
});
exports.GameActionSchema = zod_1.z.object({
    type: zod_1.z.string(),
    payload: zod_1.z.any().optional()
});
