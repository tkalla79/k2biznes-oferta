/**
 * Zod schema dla `POST /api/simulator/pricing`.
 */
import { z } from 'zod';

export const SimulatorInput = z.object({
  projectValue: z.number().positive().max(1_000_000_000),
  fundingRate: z.number().min(0.1).max(0.95),
  returningClient: z.boolean().default(false),
  projectCount: z.number().int().min(1).max(5).default(1),
  probability: z.number().min(0).max(1),
  monthsExec: z.number().int().min(1).max(60).default(18),
});

export type SimulatorInput = z.infer<typeof SimulatorInput>;
