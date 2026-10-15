import { z } from "zod";

export const modelFactoryCreateSchema = z.object({
  providerName: z.string().min(1),
  apiKey: z.string().min(1),
  config: z.looseObject({
    model: z.string().min(1),
  }),
});

export type ModelFactoryCreateInput = z.infer<typeof modelFactoryCreateSchema>;
