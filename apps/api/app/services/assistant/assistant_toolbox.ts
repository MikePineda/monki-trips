import { inject } from '@adonisjs/core'
import type { LlmTool, LlmToolCall } from '#services/llm/llm_provider'
import type { AssistantTool, ToolContext, ToolOutcome } from '#services/assistant/assistant_tool'
import { ToolInputError, toolError } from '#services/assistant/assistant_tool'
import { AddExpenseTool } from '#services/assistant/tools/add_expense_tool'
import { CreateTaskTool } from '#services/assistant/tools/create_task_tool'
import { ExtractBookingTool } from '#services/assistant/tools/extract_booking_tool'
import { GetBudgetStatusTool } from '#services/assistant/tools/get_budget_status_tool'
import { GetTodayTool } from '#services/assistant/tools/get_today_tool'
import { GetTripTool } from '#services/assistant/tools/get_trip_tool'
import { ListDocumentsTool } from '#services/assistant/tools/list_documents_tool'
import { ListEventsTool } from '#services/assistant/tools/list_events_tool'
import { ListTasksTool } from '#services/assistant/tools/list_tasks_tool'
import { ProposeEventChangesTool } from '#services/assistant/tools/propose_event_changes_tool'

/**
 * Every tool the assistant may call, by name. Read tools answer from the
 * trip of the turn only; write tools record a proposal and never write
 * trip content. `search_web` does not exist on purpose.
 */
@inject()
export class AssistantToolbox {
  private readonly tools: Map<string, AssistantTool>

  constructor(
    getTrip: GetTripTool,
    listEvents: ListEventsTool,
    getBudgetStatus: GetBudgetStatusTool,
    listDocuments: ListDocumentsTool,
    getToday: GetTodayTool,
    listTasks: ListTasksTool,
    proposeEventChanges: ProposeEventChangesTool,
    addExpense: AddExpenseTool,
    createTask: CreateTaskTool,
    extractBooking: ExtractBookingTool
  ) {
    const all: AssistantTool[] = [
      getTrip,
      listEvents,
      getBudgetStatus,
      listDocuments,
      getToday,
      listTasks,
      proposeEventChanges,
      addExpense,
      createTask,
      extractBooking,
    ]
    this.tools = new Map(all.map((tool) => [tool.definition.name, tool]))
  }

  definitions(): LlmTool[] {
    return [...this.tools.values()].map((tool) => tool.definition)
  }

  /** Runs one call; a tool the model invented or bad input answers a tool error, not a failure. */
  async run(ctx: ToolContext, call: LlmToolCall): Promise<ToolOutcome> {
    const tool = this.tools.get(call.name)
    if (!tool) return { content: 'Unknown tool. Use only the tools listed.', isError: true }
    try {
      return await tool.run(ctx, call.input ?? {})
    } catch (error) {
      if (error instanceof ToolInputError) return toolError(error)
      throw error
    }
  }
}
