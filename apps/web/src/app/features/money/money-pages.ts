/**
 * The money routes' entry point: the Money tab and the quick expense load
 * from one lazy chunk, so a person who opened Money (or any trip screen
 * that loaded it) can log an expense with no connection even before the
 * service worker has cached the app.
 */
export { default as MoneyPage } from './money.page'
export { default as QuickExpensePage } from './quick-expense.page'
