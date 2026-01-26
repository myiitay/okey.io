import { z } from 'zod';
export declare const CreateRoomSchema: z.ZodObject<{
    name: z.ZodString;
    avatar: z.ZodOptional<z.ZodString>;
    frameId: z.ZodOptional<z.ZodString>;
    gameMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        standard: "standard";
    }>>>;
}, z.core.$strip>;
export declare const JoinRoomSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    avatar: z.ZodOptional<z.ZodString>;
    frameId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const GameActionSchema: z.ZodObject<{
    type: z.ZodString;
    payload: z.ZodOptional<z.ZodAny>;
}, z.core.$strip>;
export type CreateRoomDto = z.infer<typeof CreateRoomSchema>;
export type JoinRoomDto = z.infer<typeof JoinRoomSchema>;
