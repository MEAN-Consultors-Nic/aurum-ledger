import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoriesApiService } from '../../core/services/categories-api.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { CategoryItem } from '../../core/models/category.model';
import { TransactionsApiService } from '../../core/services/transactions-api.service';
import { TransactionItem } from '../../core/models/transaction.model';

type CurrencyTotals = { USD: number; NIO: number };
type TypeTotals = { income: CurrencyTotals; expense: CurrencyTotals };
type CategoryTotals = { own: TypeTotals; children: TypeTotals; total: TypeTotals };

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-2xl font-semibold">Categories</div>
          <div class="text-sm text-slate-500">Organize income and expenses</div>
        </div>
        <button
          class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
          (click)="openCreate()"
        >
          New category
        </button>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="grid gap-3 pb-4 lg:grid-cols-5">
          <input
            type="text"
            [(ngModel)]="searchTerm"
            (keyup.enter)="applyFilters()"
            class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search categories"
          />
          <select
            [(ngModel)]="typeFilter"
            (change)="applyFilters()"
            class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select
            [(ngModel)]="parentFilter"
            (change)="applyFilters()"
            class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All parents</option>
            <option *ngFor="let category of categories" [value]="category._id">
              {{ category.name }}
            </option>
          </select>
          <button
            class="rounded border border-slate-200 px-3 py-2 text-xs uppercase tracking-wide text-slate-700"
            (click)="applyFilters()"
          >
            Filter
          </button>
          <button
            class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
            (click)="clearFilters()"
          >
            Clear
          </button>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="text-xs text-slate-500">
            Totals based on transactions within the selected range.
          </div>
          <select
            [(ngModel)]="rangeOption"
            (change)="loadTotals()"
            class="rounded-lg border border-slate-200 px-3 py-2 text-xs uppercase tracking-wide text-slate-700"
          >
            <option value="last30">Last 30 days</option>
            <option value="month">Current month</option>
          </select>
        </div>
        <div *ngIf="isLoading" class="text-sm text-slate-500">Loading categories...</div>
        <div *ngIf="error" class="text-sm text-red-600">{{ error }}</div>

        <table *ngIf="!isLoading" class="mt-2 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Name</th>
              <th class="py-2">Type</th>
              <th class="py-2">Parent</th>
              <th class="py-2 text-right">{{ rangeLabel }}</th>
              <th class="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of displayCategories" class="border-t border-slate-100">
              <td class="py-3 font-medium text-slate-900">
                <div [style.paddingLeft.px]="row.depth * 16">
                  <span *ngIf="row.depth > 0" class="mr-2 text-slate-400">•</span>
                  {{ row.item.name }}
                </div>
              </td>
              <td class="py-3">{{ row.item.type === 'income' ? 'Income' : 'Expense' }}</td>
              <td class="py-3">{{ resolveParentName(row.item.parentId) }}</td>
              <td class="py-3 text-right">
                <div *ngIf="totalsLoading" class="text-xs text-slate-400">Loading...</div>
                <ng-container *ngIf="!totalsLoading">
                  <ng-container *ngIf="getTotals(row.item) as totals">
                    <div class="text-[11px] uppercase tracking-wide text-slate-400">Income</div>
                    <div class="text-sm font-medium text-emerald-700">
                      USD {{ formatAmount(totals.total.income.USD) }} · NIO
                      {{ formatAmount(totals.total.income.NIO) }}
                    </div>
                    <div class="mt-2 text-[11px] uppercase tracking-wide text-slate-400">Expense</div>
                    <div class="text-sm font-medium text-rose-700">
                      USD {{ formatAmount(totals.total.expense.USD) }} · NIO
                      {{ formatAmount(totals.total.expense.NIO) }}
                    </div>
                    <div *ngIf="hasChildren(row.item)" class="mt-2 text-[11px] text-slate-500">
                      Own I USD {{ formatAmount(totals.own.income.USD) }} · NIO
                      {{ formatAmount(totals.own.income.NIO) }}
                      <span class="mx-1 text-slate-300">|</span>
                      Own E USD {{ formatAmount(totals.own.expense.USD) }} · NIO
                      {{ formatAmount(totals.own.expense.NIO) }}
                      <div class="mt-1">
                        Children I USD {{ formatAmount(totals.children.income.USD) }} · NIO
                        {{ formatAmount(totals.children.income.NIO) }}
                        <span class="mx-1 text-slate-300">|</span>
                        Children E USD {{ formatAmount(totals.children.expense.USD) }} · NIO
                        {{ formatAmount(totals.children.expense.NIO) }}
                      </div>
                    </div>
                  </ng-container>
                </ng-container>
              </td>
              <td class="py-3 text-right">
                <button class="text-xs text-slate-700" (click)="openEdit(row.item)">Edit</button>
                <button class="ml-3 text-xs text-slate-400" (click)="remove(row.item)">Delete</button>
              </td>
            </tr>
            <tr *ngIf="displayCategories.length === 0 && !isLoading">
              <td colspan="5" class="py-6 text-center text-sm text-slate-500">
                No categories found
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      *ngIf="isModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div class="text-lg font-semibold">{{ editing ? 'Edit category' : 'New category' }}</div>
          <button class="text-slate-400" (click)="closeModal()">X</button>
        </div>

        <form class="mt-4 space-y-4" [formGroup]="form" (ngSubmit)="save()">
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Name</label>
            <input
              formControlName="name"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Food"
            />
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Type</label>
              <select
                formControlName="type"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Parent category</label>
              <select
                formControlName="parentId"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">No parent</option>
                <option *ngFor="let category of categories" [value]="category._id">
                  {{ category.name }}
                </option>
              </select>
            </div>
          </div>

          <div *ngIf="error" class="text-sm text-red-600">{{ error }}</div>

          <div class="flex justify-end gap-3">
            <button type="button" class="text-sm text-slate-500" (click)="closeModal()">
              Cancel
            </button>
            <button
              type="submit"
              class="rounded bg-slate-900 px-4 py-2 text-xs uppercase tracking-wide text-white"
              [disabled]="form.invalid || isSaving"
            >
              {{ isSaving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class CategoriesComponent implements OnInit {
  categories: CategoryItem[] = [];
  displayCategories: Array<{ item: CategoryItem; depth: number }> = [];
  private childrenByParent = new Map<string, CategoryItem[]>();
  private categoryById = new Map<string, CategoryItem>();
  totalsByCategory = new Map<string, CategoryTotals>();
  totalsLoading = false;
  isLoading = false;
  isSaving = false;
  isModalOpen = false;
  error = '';
  editing: CategoryItem | null = null;
  rangeOption: 'last30' | 'month' = 'last30';
  searchTerm = '';
  typeFilter: '' | 'income' | 'expense' = '';
  parentFilter = '';
  form: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly categoriesApi: CategoriesApiService,
    private readonly confirm: ConfirmService,
    private readonly transactionsApi: TransactionsApiService,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      type: ['expense', [Validators.required]],
      parentId: [''],
    });
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading = true;
    this.error = '';
    this.categoriesApi.list().subscribe({
      next: (items) => {
        this.categories = items;
        this.categoryById = new Map(items.map((item) => [item._id, item]));
        this.buildChildrenIndex(items);
        this.applyFilters();
        this.isLoading = false;
        this.loadTotals();
      },
      error: () => {
        this.error = 'Unable to load categories';
        this.isLoading = false;
      },
    });
  }

  openCreate() {
    this.editing = null;
    this.form.reset({ name: '', type: 'expense', parentId: '' });
    this.isModalOpen = true;
  }

  openEdit(item: CategoryItem) {
    this.editing = item;
    this.form.reset({
      name: item.name,
      type: item.type,
      parentId: item.parentId ?? '',
    });
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  async save() {
    if (this.form.invalid) {
      return;
    }
    if (this.form.dirty) {
      const confirmed = await this.confirm.open({
        title: this.editing ? 'Confirm update' : 'Confirm create',
        message: this.editing
          ? 'Save changes to this category?'
          : 'Create this category with the current details?',
      });
      if (!confirmed) {
        return;
      }
    }

    this.isSaving = true;
    const payload = {
      name: this.form.value.name ?? '',
      type: this.form.value.type ?? 'expense',
      parentId: this.form.value.parentId || undefined,
    };

    if (this.editing) {
      this.categoriesApi.update(this.editing._id, payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.isModalOpen = false;
          this.load();
        },
        error: () => {
          this.isSaving = false;
          this.error = 'Unable to save category';
        },
      });
      return;
    }

    this.categoriesApi.create(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.isModalOpen = false;
        this.load();
      },
      error: () => {
        this.isSaving = false;
        this.error = 'Unable to create category';
      },
    });
  }

  async remove(item: CategoryItem) {
    const confirmed = await this.confirm.open({
      title: 'Confirm delete',
      message: `Delete category ${item.name}? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.categoriesApi.remove(item._id).subscribe({
      next: () => this.load(),
      error: () => {
        this.error = 'Unable to delete category';
      },
    });
  }

  resolveParentName(parentId?: string) {
    if (!parentId) {
      return '-';
    }
    return this.categories.find((item) => item._id === parentId)?.name ?? '-';
  }

  applyFilters() {
    const search = this.searchTerm.trim().toLowerCase();
    const type = this.typeFilter;
    const allowedIds = this.parentFilter ? this.collectSubtreeIds(this.parentFilter) : null;

    let filtered = this.categories.filter((item) => {
      if (allowedIds && !allowedIds.has(item._id)) {
        return false;
      }
      if (type && item.type !== type) {
        return false;
      }
      if (search && !item.name.toLowerCase().includes(search)) {
        return false;
      }
      return true;
    });

    if (search) {
      const expanded = new Map<string, CategoryItem>();
      filtered.forEach((item) => expanded.set(item._id, item));
      filtered.forEach((item) => {
        let current = item.parentId ? this.categoryById.get(item.parentId) : undefined;
        while (current) {
          if (!allowedIds || allowedIds.has(current._id)) {
            expanded.set(current._id, current);
          }
          current = current.parentId ? this.categoryById.get(current.parentId) : undefined;
        }
      });
      filtered = Array.from(expanded.values());
    }

    this.displayCategories = this.buildHierarchy(filtered);
  }

  clearFilters() {
    this.searchTerm = '';
    this.typeFilter = '';
    this.parentFilter = '';
    this.applyFilters();
  }

  getTotals(item: CategoryItem) {
    return (
      this.totalsByCategory.get(item._id) ?? {
        own: { income: { USD: 0, NIO: 0 }, expense: { USD: 0, NIO: 0 } },
        children: { income: { USD: 0, NIO: 0 }, expense: { USD: 0, NIO: 0 } },
        total: { income: { USD: 0, NIO: 0 }, expense: { USD: 0, NIO: 0 } },
      }
    );
  }

  hasChildren(item: CategoryItem) {
    return (this.childrenByParent.get(item._id) ?? []).length > 0;
  }

  formatAmount(value: number) {
    return Number(value || 0).toFixed(2);
  }

  get rangeLabel() {
    return this.rangeOption === 'month' ? 'Current month' : 'Last 30 days';
  }

  loadTotals() {
    const { from, to } =
      this.rangeOption === 'month' ? this.currentMonthRange() : this.last30DaysRange();
    this.totalsLoading = true;
    this.transactionsApi.list({ from, to }).subscribe({
      next: (items) => {
        const byCategory = this.aggregateTransactions(items);
        this.totalsByCategory = this.buildCategoryTotals(byCategory);
        this.totalsLoading = false;
      },
      error: () => {
        this.totalsByCategory = new Map();
        this.totalsLoading = false;
      },
    });
  }

  private aggregateTransactions(items: TransactionItem[]) {
    const totals = new Map<string, TypeTotals>();
    items.forEach((item) => {
      if (item.voidedAt) {
        return;
      }
      if (!item.categoryId) {
        return;
      }
      if (item.type !== 'income' && item.type !== 'expense') {
        return;
      }
      const categoryId =
        typeof item.categoryId === 'string' ? item.categoryId : item.categoryId._id;
      const current = totals.get(categoryId) ?? {
        income: { USD: 0, NIO: 0 },
        expense: { USD: 0, NIO: 0 },
      };
      const target = item.type === 'income' ? current.income : current.expense;
      if (item.currency === 'USD') {
        target.USD += Number(item.amount || 0);
      } else {
        target.NIO += Number(item.amount || 0);
      }
      totals.set(categoryId, current);
    });
    return totals;
  }

  private buildCategoryTotals(ownTotals: Map<string, TypeTotals>) {
    const result = new Map<string, CategoryTotals>();
    const roots = this.categories.filter((item) => !item.parentId);

    const addCurrency = (left: CurrencyTotals, right: CurrencyTotals): CurrencyTotals => ({
      USD: left.USD + right.USD,
      NIO: left.NIO + right.NIO,
    });

    const addType = (left: TypeTotals, right: TypeTotals): TypeTotals => ({
      income: addCurrency(left.income, right.income),
      expense: addCurrency(left.expense, right.expense),
    });

    const zeroCurrency = (): CurrencyTotals => ({ USD: 0, NIO: 0 });
    const zeroType = (): TypeTotals => ({ income: zeroCurrency(), expense: zeroCurrency() });

    const walk = (item: CategoryItem): TypeTotals => {
      const own = ownTotals.get(item._id) ?? zeroType();
      const childrenTotals = (this.childrenByParent.get(item._id) ?? []).reduce(
        (acc, child) => addType(acc, walk(child)),
        zeroType(),
      );
      const total = addType(own, childrenTotals);
      result.set(item._id, { own, children: childrenTotals, total });
      return total;
    };

    roots.forEach((root) => walk(root));
    this.categories.forEach((item) => {
      if (!result.has(item._id)) {
        walk(item);
      }
    });

    return result;
  }

  private last30DaysRange() {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    return {
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
    };
  }

  private currentMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      from: start.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    };
  }

  private collectSubtreeIds(parentId: string) {
    const result = new Set<string>();
    const stack = [parentId];
    while (stack.length) {
      const current = stack.pop();
      if (!current || result.has(current)) {
        continue;
      }
      result.add(current);
      const children = this.childrenByParent.get(current) ?? [];
      children.forEach((child) => stack.push(child._id));
    }
    return result;
  }

  private buildChildrenIndex(items: CategoryItem[]) {
    const byParent = new Map<string, CategoryItem[]>();
    items.forEach((item) => {
      const parent = item.parentId ?? '';
      if (!parent) {
        return;
      }
      if (!byParent.has(parent)) {
        byParent.set(parent, []);
      }
      byParent.get(parent)?.push(item);
    });
    this.childrenByParent = byParent;
  }

  private buildHierarchy(items: CategoryItem[]) {
    const byParent = new Map<string, CategoryItem[]>();
    const roots: CategoryItem[] = [];
    const allowedIds = new Set(items.map((item) => item._id));

    items.forEach((item) => {
      const parent = item.parentId ?? '';
      if (!parent || !allowedIds.has(parent)) {
        roots.push(item);
        return;
      }
      if (!byParent.has(parent)) {
        byParent.set(parent, []);
      }
      byParent.get(parent)?.push(item);
    });

    const sortByName = (list: CategoryItem[]) =>
      list.sort((a, b) => a.name.localeCompare(b.name));

    sortByName(roots);

    const result: Array<{ item: CategoryItem; depth: number }> = [];
    const walk = (node: CategoryItem, depth: number) => {
      result.push({ item: node, depth });
      const children = byParent.get(node._id);
      if (children && children.length) {
        sortByName(children);
        children.forEach((child) => walk(child, depth + 1));
      }
    };

    roots.forEach((root) => walk(root, 0));
    return result;
  }
}
