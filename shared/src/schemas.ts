import { z } from 'zod';

export const CreateRoomSchema = z.object({
    name: z.string().min(1, "İsim gerekli").max(20, "İsim çok uzun"),
    avatar: z.string().optional(),
    frameId: z.string().optional(),
    gameMode: z.enum(['standard', '101']).optional().default('standard')
});

export const JoinRoomSchema = z.object({
    code: z.string().min(1, "Oda kodu gerekli"),
    name: z.string().min(1, "İsim gerekli").max(20, "İsim çok uzun"),
    avatar: z.string().optional(),
    frameId: z.string().optional()
});

export const GameActionSchema = z.object({
    type: z.string(),
    payload: z.any().optional()
});

export type CreateRoomDto = z.infer<typeof CreateRoomSchema>;
export type JoinRoomDto = z.infer<typeof JoinRoomSchema>;
