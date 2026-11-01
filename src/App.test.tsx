import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';
import { ToastProvider } from './hooks/useToasts';
import { DATA_KEY } from './store/persistence';
import { StoreProvider } from './store/StoreContext';

function renderApp() {
  return render(
    <StoreProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StoreProvider>,
  );
}

const rows = () => screen.queryAllByTestId('task-row');
const stored = () => JSON.parse(localStorage.getItem(DATA_KEY) ?? '{"tasks":[]}') as { tasks: Array<{ title: string; completedAt: number | null }> };

describe('Taskpad app', () => {
  it('adds a task through the quick-add box with parsed details and persists it', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/all';
    renderApp();
    expect(screen.getByText('No open tasks')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Add a task'), 'Pay rent tomorrow !high #bills{enter}');

    expect(rows()).toHaveLength(1);
    const row = within(rows()[0]!);
    expect(row.getByText('Pay rent')).toBeInTheDocument();
    expect(row.getByText('Tomorrow')).toBeInTheDocument();
    expect(row.getByText('#bills')).toBeInTheDocument();
    expect(screen.getByLabelText('Add a task')).toHaveValue('');

    await waitFor(() => expect(stored().tasks.map((t) => t.title)).toEqual(['Pay rent']));
  });

  it('completes a task, then undoes with the toolbar button', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/all';
    renderApp();
    await user.type(screen.getByLabelText('Add a task'), 'Write tests{enter}');

    await user.click(screen.getByRole('checkbox', { name: /Complete "Write tests"/ }));
    expect(rows()).toHaveLength(0); // hidden because "Show done" is off
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(rows()).toHaveLength(1);
  });

  it('shows a delete toast with Undo that restores the task', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/all';
    renderApp();
    await user.type(screen.getByLabelText('Add a task'), 'Temporary{enter}');
    await user.click(screen.getByRole('button', { name: 'Delete "Temporary"' }));
    expect(rows()).toHaveLength(0);
    // Two "Undo" buttons exist now: the toolbar's and the toast's. The toast renders last.
    await user.click(screen.getAllByRole('button', { name: 'Undo' }).at(-1)!);
    expect(rows()).toHaveLength(1);
  });

  it('filters with search and shows an empty state', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/all';
    renderApp();
    await user.type(screen.getByLabelText('Add a task'), 'Alpha{enter}');
    await user.type(screen.getByLabelText('Add a task'), 'Beta{enter}');
    await user.type(screen.getByLabelText('Search tasks'), 'bet');
    expect(rows()).toHaveLength(1);
    await user.type(screen.getByLabelText('Search tasks'), 'zzz');
    expect(screen.getByText('No matching tasks')).toBeInTheDocument();
  });

  it('creates a list and files new tasks into it', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'New list' }));
    await user.type(screen.getByLabelText('Name'), 'Work');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Add a task'), 'Ship it{enter}');
    expect(rows()).toHaveLength(1);
    // Appears in the sidebar count for the list.
    expect(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: /^Work/ })).toHaveTextContent('1');
  });

  it('edits a task in the dialog', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/all';
    renderApp();
    await user.type(screen.getByLabelText('Add a task'), 'Draft{enter}');
    await user.click(screen.getByRole('button', { name: 'Draft' }));
    const dialog = await screen.findByRole('dialog');
    const title = within(dialog).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Final draft');
    await user.type(within(dialog).getByLabelText('New subtask'), 'Proofread{enter}');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Final draft')).toBeInTheDocument();
    expect(screen.getByTitle('0 of 1 subtasks done')).toBeInTheDocument();
  });

  it('loads existing data from storage', () => {
    localStorage.setItem(DATA_KEY, JSON.stringify({ version: 1, lists: [], tasks: [{ id: 'a', title: 'From last time' }] }));
    window.location.hash = '#/inbox';
    renderApp();
    expect(screen.getByText('From last time')).toBeInTheDocument();
  });

  it('tracks a job application from adding through status changes, follow-ups and delete with undo', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: /Job applications/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Job applications' })).toBeInTheDocument();
    expect(screen.getByText('No applications yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add application' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Company'), 'Acme');
    await user.type(within(dialog).getByLabelText('Role'), 'Frontend Engineer');
    await user.type(within(dialog).getByLabelText('Job posting link'), 'jobs.acme.dev/42');
    await user.click(within(dialog).getByRole('button', { name: 'Add application' }));

    const jobRows = () => screen.queryAllByTestId('job-row');
    expect(jobRows()).toHaveLength(1);
    expect(within(jobRows()[0]!).getByRole('link', { name: /Posting/ })).toHaveAttribute('href', 'https://jobs.acme.dev/42');
    expect(within(jobRows()[0]!).getByText(/Applied Today/)).toBeInTheDocument();

    // Move it along the pipeline from the row's status menu.
    await user.selectOptions(screen.getByLabelText('Status for Frontend Engineer at Acme'), 'interviewing');
    expect(screen.getByRole('heading', { level: 2, name: /Interviewing/ })).toBeInTheDocument();

    // A follow-up set for today is flagged in the row and in the sidebar.
    await user.click(screen.getByRole('button', { name: /^Frontend Engineer/ }));
    const edit = await screen.findByRole('dialog');
    expect(within(edit).getByRole('list', { name: 'Status timeline' })).toHaveTextContent(/Applied.*Interviewing/);
    await user.type(within(edit).getByLabelText('Follow up on'), new Date().toLocaleDateString('en-CA'));
    await user.click(within(edit).getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Follow up now')).toBeInTheDocument();
    expect(screen.getByText('1 active · 1 follow-up due')).toBeInTheDocument();

    await waitFor(() => expect((JSON.parse(localStorage.getItem(DATA_KEY) ?? '{}') as { jobs?: unknown[] }).jobs).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: 'Delete Frontend Engineer at Acme' }));
    expect(jobRows()).toHaveLength(0);
    await user.click(screen.getAllByRole('button', { name: 'Undo' }).at(-1)!);
    expect(jobRows()).toHaveLength(1);
  });
});
