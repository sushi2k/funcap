import { z } from "zod";

// Example shared schema. `display_name` rule from security.md §3.
export const DisplayName = z
  .string()
  .min(2)
  .max(30)
  .regex(/^[\p{L}0-9 _-]+$/u);

export const SelfLevel = z.number().int().min(1).max(10);

export const PublicUserSchema = z.object({
  id: z.string().uuid(),
  display_name: DisplayName,
  self_level: SelfLevel.nullable(),
});
