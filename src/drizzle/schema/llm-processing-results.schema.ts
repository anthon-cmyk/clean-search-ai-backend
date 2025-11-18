import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  jsonb,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { searchTerms } from './search-terms.schema';

export const llmProcessingResults = pgTable(
  'llm_processing_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    searchTermId: uuid('search_term_id')
      .notNull()
      .references(() => searchTerms.id, { onDelete: 'cascade' }),
    prompt: text('prompt').notNull(),
    llmResponse: text('llm_response').notNull(),
    llmModel: text('llm_model').notNull(),
    // Store structured response if needed
    structuredResponse: jsonb('structured_response'),
    tokenUsage: jsonb('token_usage').$type<{
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }>(),
    processingTimeMs: integer('processing_time_ms'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    searchTermIdIdx: index('llm_results_search_term_id_idx').on(
      table.searchTermId,
    ),
    createdAtIdx: index('llm_results_created_at_idx').on(table.createdAt),
  }),
);

const baseInsertSchema = createInsertSchema(llmProcessingResults);
const baseSelectSchema = createSelectSchema(llmProcessingResults);

export const insertLlmProcessingResultSchema = baseInsertSchema.extend({
  prompt: z.string().min(1),
  llmResponse: z.string().min(1),
  llmModel: z.string().min(1),
});

export const selectLlmProcessingResultSchema = baseSelectSchema;

export type TInsertLlmProcessingResult = z.infer<
  typeof insertLlmProcessingResultSchema
>;
export type TSelectLlmProcessingResult = z.infer<
  typeof selectLlmProcessingResultSchema
>;

export const llmProcessingResultsRelations = relations(
  llmProcessingResults,
  ({ one }) => ({
    searchTerm: one(searchTerms, {
      fields: [llmProcessingResults.searchTermId],
      references: [searchTerms.id],
    }),
  }),
);
