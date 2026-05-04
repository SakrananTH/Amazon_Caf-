import { requireSupabase } from './client.js';
import {
  mapCalendarDaySettingsRows,
  mapEmployeeAvailabilityRows,
  mapEmployeeRow,
  mapInventoryHistoryRows,
  mapInventoryItemRows,
  mapIssueRows,
  mapRequestRows,
  mapScheduleRows,
  mapSettingsRow,
} from './mappers.js';

function unwrapResult(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data;
}

export async function loadAppStateFromSupabase() {
  const client = requireSupabase();

  const [
    employeesResult,
    availabilityResult,
    calendarSettingsResult,
    scheduleBlocksResult,
    scheduleAssignmentsResult,
    requestsResult,
    inventoryItemsResult,
    inventoryHistoryResult,
    issueReportsResult,
    settingsResult,
  ] = await Promise.all([
    client.from('employees').select('*').order('id', { ascending: true }),
    client.from('employee_availability').select('*'),
    client.from('calendar_day_settings').select('*'),
    client.from('schedule_blocks').select('*').order('date_key', { ascending: true }).order('id', { ascending: true }),
    client.from('schedule_block_assignments').select('*'),
    client.from('requests').select('*').order('created_at', { ascending: false }),
    client.from('inventory_items').select('*').order('id', { ascending: true }),
    client.from('inventory_history').select('*').order('logged_at', { ascending: false }),
    client.from('issue_reports').select('*').order('created_at', { ascending: false }),
    client.from('app_settings').select('*').limit(1).maybeSingle(),
  ]);

  return {
    employees: unwrapResult(employeesResult, 'employees').map(mapEmployeeRow),
    employeeAvailabilityCalendar: mapEmployeeAvailabilityRows(unwrapResult(availabilityResult, 'employee_availability')),
    calendarDaySettings: mapCalendarDaySettingsRows(unwrapResult(calendarSettingsResult, 'calendar_day_settings')),
    timeBlocks: mapScheduleRows(
      unwrapResult(scheduleBlocksResult, 'schedule_blocks'),
      unwrapResult(scheduleAssignmentsResult, 'schedule_block_assignments'),
    ),
    requests: mapRequestRows(unwrapResult(requestsResult, 'requests')),
    inventoryItems: mapInventoryItemRows(unwrapResult(inventoryItemsResult, 'inventory_items')),
    inventoryHistory: mapInventoryHistoryRows(unwrapResult(inventoryHistoryResult, 'inventory_history')),
    issueReports: mapIssueRows(unwrapResult(issueReportsResult, 'issue_reports')),
    settings: mapSettingsRow(unwrapResult(settingsResult, 'app_settings')),
  };
}
