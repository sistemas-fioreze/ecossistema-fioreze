import type { AsanaSetup, AsanaTask, Hotel } from "./types";
import { addDays, dateLabel, escapeHtml as e, fromIso, isoDate, option, weekStart } from "./utils";

export interface AsanaContext {
  setup: AsanaSetup | null;
  tasks: AsanaTask[];
  hotels: Hotel[];
  day: string;
  today: string;
  hotelFilter: string;
}

export function asanaCalendarView(context: AsanaContext): string {
  const setup = context.setup;
  const heading = `<div class="page-heading"><div><p class="eyebrow">Integrações</p><h1>Calendário do Asana</h1><p class="subtle">Tarefas das unidades organizadas no calendário de marketing.</p></div></div>`;
  if (!setup?.configured) return `${heading}${connectionState("Configuração pendente", "Cadastre o aplicativo OAuth do Asana para liberar a conexão individual de cada usuário.", false)}`;
  if (!setup.connected) return `${heading}${connectionState("Conecte sua conta do Asana", "Cada usuário autoriza a própria conta. O Planner nunca recebe sua senha e respeita exatamente os projetos que você pode acessar.", true)}`;

  const focus = fromIso(context.day);
  const monthStart = isoDate(new Date(focus.getFullYear(), focus.getMonth(), 1));
  const monthEnd = isoDate(new Date(focus.getFullYear(), focus.getMonth() + 1, 0));
  const gridStart = weekStart(monthStart);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const monthName = dateLabel(monthStart, { month: "long", year: "numeric" });
  const mappedCount = setup.units.filter((unit) => unit.project_gid).length;
  const calendar = days.map((day) => {
    const inside = day >= monthStart && day <= monthEnd;
    const tasks = context.tasks.filter((task) => task.start_date && task.end_date && day >= task.start_date && day <= task.end_date);
    const visible = tasks.slice(0, 3);
    const taskItems = visible.map((task) => `<a class="asana-task ${task.completed ? "completed" : ""}" data-hotel="${e(task.hotel_id)}" href="${e(task.permalink_url || "#")}" ${task.permalink_url ? 'target="_blank" rel="noopener noreferrer"' : ""} title="${e(`${task.project_name} · ${task.name}`)}"><span>${e(task.name)}</span>${task.assignee_name ? `<small>${e(task.assignee_name)}</small>` : ""}</a>`).join("");
    const more = tasks.length > visible.length ? `<span class="asana-task-more">+${tasks.length - visible.length} tarefas</span>` : "";
    return `<div class="asana-calendar-day ${inside ? "" : "outside"} ${day === context.today ? "today" : ""}"><time datetime="${day}">${Number(day.slice(-2))}</time><div class="asana-day-tasks">${taskItems}${more}</div></div>`;
  }).join("");
  const unitOptions = context.hotels.filter((hotel) => setup.units.some((unit) => unit.hotel_id === hotel.id)).map((hotel) => option(hotel.id, hotel.short_name, context.hotelFilter)).join("");
  const mappingRows = setup.units.map((unit) => `<label class="asana-mapping-row"><span><strong>${e(unit.expected_project_name)}</strong><small>${unit.project_gid ? "Projeto conectado" : "Projeto ainda não localizado"}</small></span><select data-asana-hotel="${e(unit.hotel_id)}"><option value="">Não vinculado</option>${setup.projects.map((project) => option(project.gid, project.name, unit.project_gid || "")).join("")}</select></label>`).join("");
  const workspaceOptions = setup.workspaces.map((workspace) => option(workspace.gid, workspace.name, setup.connection?.workspace_gid || "")).join("");
  const integration = `<details class="asana-integration"><summary><span><strong>${e(setup.connection?.account_name || setup.connection?.account_email || "Conta Asana")}</strong><small>${e(setup.connection?.workspace_name || "Selecione o workspace")} · ${mappedCount}/6 unidades conectadas</small></span><i data-lucide="chevron-down" aria-hidden="true"></i></summary><div class="asana-integration-body">${setup.error ? `<p class="calendar-error">${e(setup.error)}</p>` : ""}<form id="asanaWorkspaceForm" class="asana-workspace-form"><label><span>Workspace</span><select name="workspace_gid" required>${workspaceOptions}</select></label><button class="button" type="submit">Usar workspace</button></form><form id="asanaProjectForm" class="asana-mapping-list"><div class="section-heading"><div><h2>Projetos das unidades</h2><p class="subtle">Os nomes oficiais são reconhecidos automaticamente. Ajuste somente quando o projeto usar outro nome no Asana.</p></div></div>${mappingRows}<div class="asana-mapping-actions"><button class="button primary" type="submit">Salvar vínculos</button><button class="button danger" type="button" data-action="disconnect-asana">Desconectar Asana</button></div></form></div></details>`;
  const toolbar = `<div class="asana-calendar-toolbar"><div class="asana-calendar-title"><button class="icon-button" type="button" data-action="asana-prev-month" aria-label="Mês anterior"><i data-lucide="chevron-left"></i></button><h2>${e(monthName)}</h2><button class="icon-button" type="button" data-action="asana-next-month" aria-label="Próximo mês"><i data-lucide="chevron-right"></i></button><button class="button" type="button" data-action="asana-today">Hoje</button></div><label class="asana-unit-filter"><span>Unidade</span><select id="asanaHotelFilter"><option value="all">Todas as unidades</option>${unitOptions}</select></label></div>`;
  return `${heading}${integration}<section class="asana-calendar-shell">${toolbar}<div class="asana-weekdays">${["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label) => `<span>${label}</span>`).join("")}</div><div class="asana-calendar-grid">${calendar}</div></section>`;
}

function connectionState(title: string, description: string, canConnect: boolean): string {
  return `<section class="asana-connect-state"><span class="asana-connect-icon"><i data-lucide="calendar-days" aria-hidden="true"></i></span><div><h2>${e(title)}</h2><p>${e(description)}</p></div>${canConnect ? '<button class="button primary" type="button" data-action="connect-asana">Conectar com o Asana</button>' : ""}</section>`;
}
