const STORAGE_USERS = 'rassd_users_v2';
const STORAGE_CURRENT = 'rassd_current_user_v2';

const CURRENCIES = [
  { code: 'EGP', label: 'جنيه مصري', symbol: 'ج.م' },
  { code: 'SAR', label: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'USD', label: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', label: 'يورو', symbol: '€' },
  { code: 'AED', label: 'درهم إماراتي', symbol: 'د.إ' },
  { code: 'KWD', label: 'دينار كويتي', symbol: 'د.ك' },
  { code: 'QAR', label: 'ريال قطري', symbol: 'ر.ق' },
  { code: 'GBP', label: 'جنيه إسترليني', symbol: '£' },
  { code: 'TRY', label: 'ليرة تركية', symbol: '₺' },
  { code: 'CUSTOM', label: 'عملة أخرى', symbol: '' }
];

const INCOME_CATEGORIES = ['راتب', 'عمل حر', 'هدية', 'بيع شيء', 'استثمار', 'دخل آخر'];
const EXPENSE_CATEGORIES = ['أكل وشرب', 'مواصلات', 'سكن وفواتير', 'قسط أو دين', 'صحة', 'تعليم', 'ترفيه', 'تسوق', 'مصروف آخر'];
const MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

let currentEmail = null;
let userData = null;
let selectedMonth = getCurrentMonth();
let activeFilter = 'all';
let onboardingStep = 0;

const onboardingSteps = [
  {
    title: 'أهلاً بيك في رصد',
    text: 'هنسألك شوية أسئلة بسيطة أول مرة بس عشان التطبيق يشتغل على بياناتك من البداية.',
    html: () => ''
  },
  {
    title: 'اختار عملتك الافتراضية',
    text: 'تقدر بعد كده تختار عملة مختلفة لكل دخل أو مصروف. التطبيق هيعرض الأرقام زي ما دخلتها.',
    html: () => `<label>العملة الافتراضية<select id="ob-currency">${currencyOptions(userData.defaultCurrency)}</select></label>`
  },
  {
    title: 'دخل الشهر الحالي',
    text: 'لو معاك دخل أو رصيد داخل الشهر، اكتبه هنا. تقدر تعدله أو تحذفه لاحقاً من السجل.',
    html: () => `<div class="two-cols"><label>المبلغ<input id="ob-income" type="number" min="0" step="0.01" placeholder="مثلاً 2000"></label><label>العملة<select id="ob-income-currency">${currencyOptions(userData.defaultCurrency)}</select></label></div>`
  },
  {
    title: 'ميزانية الشهر',
    text: 'حدد سقف تقريبي لمصاريف الشهر عشان تعرف وضعك المالي ماشي إزاي.',
    html: () => `<div class="two-cols"><label>الميزانية<input id="ob-budget" type="number" min="0" step="0.01" placeholder="مثلاً 5000"></label><label>العملة<select id="ob-budget-currency">${currencyOptions(userData.defaultCurrency)}</select></label></div>`
  }
];

const $ = id => document.getElementById(id);

function readUsers(){
  try { return JSON.parse(localStorage.getItem(STORAGE_USERS) || '{}'); }
  catch { return {}; }
}

function writeUsers(users){
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

function saveUser(){
  if(!currentEmail || !userData) return;
  const users = readUsers();
  if(!users[currentEmail]) return;
  users[currentEmail].data = userData;
  writeUsers(users);
}

function makeDefaultData(name){
  return {
    name,
    defaultCurrency: 'EGP',
    onboarded: false,
    months: [getCurrentMonth()],
    budgets: {},
    transactions: []
  };
}

function getCurrentMonth(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
}

function today(){
  return new Date().toISOString().slice(0, 10);
}

function uid(){
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeEmail(email){
  return String(email || '').trim().toLowerCase();
}

function currencyByCode(code){
  return CURRENCIES.find(c => c.code === code) || { code, label: code, symbol: code };
}

function currencyOptions(selected = 'EGP'){
  return CURRENCIES.map(c => `<option value="${c.code}" ${c.code === selected ? 'selected' : ''}>${c.label}${c.symbol ? ` — ${c.symbol}` : ''}</option>`).join('');
}

function categoryOptions(type, selected = ''){
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return cats.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
}

function monthName(month){
  const [year, m] = month.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${year}`;
}

function formatAmount(amount, currency){
  const n = Number(amount || 0);
  const c = currencyByCode(currency);
  return `${n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ${c.symbol || c.code}`;
}

function parseAmountValue(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function showError(id, msg){
  const el = $(id);
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3500);
}

function switchAuth(mode){
  $('login-tab').classList.toggle('active', mode === 'login');
  $('signup-tab').classList.toggle('active', mode === 'signup');
  $('login-form').classList.toggle('active', mode === 'login');
  $('signup-form').classList.toggle('active', mode === 'signup');
}

function loginUser(event){
  event.preventDefault();
  const email = normalizeEmail($('login-email').value);
  const password = $('login-password').value;
  const users = readUsers();

  if(!users[email] || users[email].password !== password){
    showError('login-error', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    return;
  }

  currentEmail = email;
  userData = users[email].data || makeDefaultData(users[email].name || email.split('@')[0]);
  localStorage.setItem(STORAGE_CURRENT, currentEmail);
  selectedMonth = getCurrentMonth();
  ensureMonth(selectedMonth);
  saveUser();

  if(!userData.onboarded){
    showOnboarding();
  }else{
    openApp();
  }
}

function signupUser(event){
  event.preventDefault();
  const name = $('signup-name').value.trim();
  const email = normalizeEmail($('signup-email').value);
  const password = $('signup-password').value;
  const password2 = $('signup-password2').value;
  const users = readUsers();

  if(!name || !email || password.length < 6 || password !== password2){
    showError('signup-error', 'تأكد من الاسم والبريد وأن كلمة المرور 6 أحرف على الأقل ومتطابقة.');
    return;
  }
  if(users[email]){
    showError('signup-error', 'هذا البريد مسجل بالفعل. استخدم تسجيل الدخول.');
    return;
  }

  users[email] = { password, createdAt: new Date().toISOString(), data: makeDefaultData(name) };
  writeUsers(users);
  currentEmail = email;
  userData = users[email].data;
  localStorage.setItem(STORAGE_CURRENT, currentEmail);
  selectedMonth = getCurrentMonth();
  showOnboarding();
}

function showOnboarding(){
  $('auth-screen').classList.remove('active');
  $('app-screen').classList.remove('active');
  $('onboarding-screen').classList.add('active');
  onboardingStep = 0;
  renderOnboarding();
}

function renderOnboarding(){
  const step = onboardingSteps[onboardingStep];
  $('onboarding-step-label').textContent = `خطوة ${onboardingStep + 1} من ${onboardingSteps.length}`;
  $('progress-dots').innerHTML = onboardingSteps.map((_, i) => `<span class="${i <= onboardingStep ? 'active' : ''}"></span>`).join('');
  $('onboarding-body').innerHTML = `<h1>${step.title}</h1><p>${step.text}</p>${step.html()}`;
  $('onboarding-next').textContent = onboardingStep === onboardingSteps.length - 1 ? 'ابدأ استخدام التطبيق' : 'التالي';
}

function collectOnboardingStep(){
  if(onboardingStep === 1){
    const v = $('ob-currency')?.value;
    if(v) userData.defaultCurrency = v;
  }
  if(onboardingStep === 2){
    const amount = parseAmountValue($('ob-income')?.value);
    const currency = $('ob-income-currency')?.value || userData.defaultCurrency;
    if(amount > 0){
      userData.transactions.push({
        id: uid(), type: 'income', title: 'دخل بداية الشهر', amount, currency,
        category: 'راتب', date: today(), note: 'تمت إضافته أثناء تهيئة الحساب', createdAt: new Date().toISOString()
      });
    }
  }
  if(onboardingStep === 3){
    const amount = parseAmountValue($('ob-budget')?.value);
    const currency = $('ob-budget-currency')?.value || userData.defaultCurrency;
    if(amount > 0) userData.budgets[selectedMonth] = { amount, currency };
  }
  ensureMonth(selectedMonth);
  saveUser();
}

function nextOnboarding(){
  collectOnboardingStep();
  if(onboardingStep < onboardingSteps.length - 1){
    onboardingStep += 1;
    renderOnboarding();
  }else{
    finishOnboarding();
  }
}

function finishOnboarding(){
  if(!userData) return;
  userData.onboarded = true;
  ensureMonth(selectedMonth);
  saveUser();
  openApp();
}

function openApp(){
  $('auth-screen').classList.remove('active');
  $('onboarding-screen').classList.remove('active');
  $('app-screen').classList.add('active');
  renderAll();
}

function logoutUser(){
  localStorage.removeItem(STORAGE_CURRENT);
  currentEmail = null;
  userData = null;
  $('app-screen').classList.remove('active');
  $('auth-screen').classList.add('active');
  switchAuth('login');
}

function ensureMonth(month){
  if(!userData.months.includes(month)) userData.months.push(month);
  userData.months.sort().reverse();
}

function addMonth(event){
  event.preventDefault();
  const month = $('new-month').value;
  if(!month) return;
  selectedMonth = month;
  ensureMonth(month);
  saveUser();
  closeModal();
  renderAll();
}

function monthTransactions(){
  return userData.transactions.filter(t => t.date && t.date.slice(0,7) === selectedMonth);
}

function totalsForMonth(){
  const txs = monthTransactions();
  const income = txs.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount || 0), 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount || 0), 0);
  return { income, expense, net: income - expense, count: txs.length };
}

function groupedTotals(type){
  const map = new Map();
  monthTransactions().filter(t => !type || t.type === type).forEach(t => {
    const key = `${t.category || 'بدون تصنيف'}__${t.currency}`;
    const old = map.get(key) || { category: t.category || 'بدون تصنيف', currency: t.currency, amount: 0, count: 0 };
    old.amount += Number(t.amount || 0);
    old.count += 1;
    map.set(key, old);
  });
  return Array.from(map.values()).sort((a,b) => b.amount - a.amount);
}

function summaryByCurrency(type){
  const map = new Map();
  monthTransactions().filter(t => t.type === type).forEach(t => {
    map.set(t.currency, (map.get(t.currency) || 0) + Number(t.amount || 0));
  });
  return Array.from(map.entries()).map(([currency, amount]) => formatAmount(amount, currency)).join(' + ') || formatAmount(0, userData.defaultCurrency);
}

function renderAll(){
  renderHeader();
  renderMonths();
  renderHome();
  renderMonthly();
  renderTransactions();
  renderSettings();
}

function renderHeader(){
  $('greeting').textContent = getGreeting();
  $('user-name').textContent = userData.name;
  $('avatar').textContent = (userData.name || 'ر').trim()[0];
}

function getGreeting(){
  const h = new Date().getHours();
  if(h < 12) return 'صباح الخير';
  if(h < 18) return 'مساء الخير';
  return 'مساء النور';
}

function renderMonths(){
  ensureMonth(getCurrentMonth());
  const months = [...new Set(userData.months.concat(userData.transactions.map(t => t.date.slice(0,7))))].filter(Boolean).sort().reverse();
  userData.months = months;
  $('month-tabs').innerHTML = months.map(m => `<button class="month-tab ${m === selectedMonth ? 'active' : ''}" type="button" onclick="selectMonth('${m}')">${monthName(m)}</button>`).join('');
}

function selectMonth(month){
  selectedMonth = month;
  ensureMonth(month);
  saveUser();
  renderAll();
}

function renderHome(){
  const totals = totalsForMonth();
  const budget = userData.budgets[selectedMonth];
  $('month-title').textContent = monthName(selectedMonth);
  $('net-total').textContent = summaryNetText();
  $('income-total').textContent = summaryByCurrency('income');
  $('expense-total').textContent = summaryByCurrency('expense');
  $('transactions-count').textContent = totals.count.toLocaleString('ar-EG');
  $('budget-left').textContent = budget ? formatAmount(Math.max(0, Number(budget.amount || 0) - totals.expense), budget.currency) : 'غير محددة';
  $('smart-insight').textContent = getInsight(totals, budget);
  const recent = monthTransactions().sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0,5);
  $('recent-list').innerHTML = recent.length ? recent.map(transactionHTML).join('') : '<div class="empty">لا توجد عمليات في هذا الشهر بعد. أضف دخلك ومصاريفك لتبدأ المتابعة.</div>';
}

function summaryNetText(){
  const currencies = new Set(monthTransactions().map(t => t.currency));
  if(currencies.size <= 1){
    const currency = [...currencies][0] || userData.defaultCurrency;
    const income = monthTransactions().filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount || 0), 0);
    const expense = monthTransactions().filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount || 0), 0);
    return formatAmount(income - expense, currency);
  }
  return 'أكثر من عملة';
}

function getInsight(totals, budget){
  if(totals.count === 0) return 'لسه مفيش بيانات للشهر ده. ابدأ بإضافة الدخل الحالي ثم سجل المصاريف أول بأول.';
  if(!budget) return 'أضف ميزانية للشهر عشان نقدر نقولك أنت ماشي داخل الحدود ولا محتاج تقلل المصاريف.';
  const spent = totals.expense;
  const limit = Number(budget.amount || 0);
  if(!limit) return 'ميزانيتك صفر حالياً. عدّلها من الإعدادات أو زر الميزانية.';
  const pct = spent / limit;
  if(pct < .6) return `وضعك جيد. صرفت حوالي ${Math.round(pct*100).toLocaleString('ar-EG')}٪ من ميزانية الشهر.`;
  if(pct < .9) return `انتبه. وصلت إلى ${Math.round(pct*100).toLocaleString('ar-EG')}٪ من ميزانية الشهر، حاول تراجع المصاريف غير الضرورية.`;
  return `تحذير. صرفت ${Math.round(pct*100).toLocaleString('ar-EG')}٪ من الميزانية، الأفضل توقف أي مصاريف غير أساسية.`;
}

function renderMonthly(){
  const totals = totalsForMonth();
  const budget = userData.budgets[selectedMonth];
  $('monthly-subtitle').textContent = `تحليل ${monthName(selectedMonth)} بناءً على البيانات المسجلة.`;
  let cls = 'good';
  let title = 'الأمور مستقرة';
  let msg = 'دخلك يغطي مصاريفك في الشهر الحالي.';
  let pct = 0;
  if(budget && Number(budget.amount) > 0){
    pct = Math.min(100, Math.round((totals.expense / Number(budget.amount)) * 100));
    if(pct >= 90){ cls = 'bad'; title = 'مصاريفك عالية'; msg = 'أنت قريب جداً من الميزانية أو تعديتها. راجع المصاريف الكبيرة.'; }
    else if(pct >= 65){ cls = 'warn'; title = 'محتاج متابعة'; msg = 'المصاريف بدأت تقرب من الميزانية. تابع باقي الشهر بحذر.'; }
  }else if(totals.net < 0){
    cls = 'bad'; title = 'الصافي بالسالب'; msg = 'مصاريفك أعلى من دخلك المسجل في هذا الشهر.';
  }
  $('monthly-health').innerHTML = `
    <div class="health-main ${cls}">
      <strong>${title}</strong>
      <p>${msg}</p>
    </div>
    <div class="bar"><span style="width:${pct}%"></span></div>
    <div class="summary-grid">
      <div class="summary income"><span>إجمالي الدخل</span><strong>${summaryByCurrency('income')}</strong></div>
      <div class="summary expense"><span>إجمالي المصاريف</span><strong>${summaryByCurrency('expense')}</strong></div>
    </div>`;

  const groups = groupedTotals('expense');
  $('category-summary').innerHTML = groups.length ? groups.map(g => `<div class="cat-row"><span>${g.category} • ${g.count} عملية</span><strong>${formatAmount(g.amount, g.currency)}</strong></div>`).join('') : '<div class="empty">لا توجد مصاريف مصنفة في هذا الشهر.</div>';
}

function renderTransactions(){
  const txs = monthTransactions()
    .filter(t => activeFilter === 'all' || t.type === activeFilter)
    .sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  document.querySelectorAll('.filter').forEach(b => b.classList.toggle('active', b.dataset.filter === activeFilter));
  $('transactions-list').innerHTML = txs.length ? txs.map(transactionHTML).join('') : '<div class="empty">لا توجد عمليات مطابقة في هذا الشهر.</div>';
}

function transactionHTML(t){
  const icon = t.type === 'income' ? '↗' : '↘';
  const sign = t.type === 'income' ? '+' : '-';
  return `
    <article class="tx">
      <div class="tx-icon">${icon}</div>
      <div class="tx-info">
        <strong>${escapeHTML(t.title)}</strong>
        <span>${escapeHTML(t.category)} • ${t.date}${t.note ? ` • ${escapeHTML(t.note)}` : ''}</span>
        <div class="tx-actions">
          <button class="mini-action" type="button" onclick="editTransaction('${t.id}')">تعديل</button>
          <button class="mini-action delete" type="button" onclick="deleteTransaction('${t.id}')">حذف</button>
        </div>
      </div>
      <div class="tx-amount ${t.type}">${sign} ${formatAmount(t.amount, t.currency)}</div>
    </article>`;
}

function escapeHTML(value){
  return String(value || '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function setFilter(filter){
  activeFilter = filter;
  renderTransactions();
}

function renderSettings(){
  $('settings-name').value = userData.name || '';
  $('settings-default-currency').innerHTML = currencyOptions(userData.defaultCurrency);
  const budget = userData.budgets[selectedMonth];
  $('settings-budget').value = budget?.amount || '';
}

function saveSettings(){
  const name = $('settings-name').value.trim();
  const currency = $('settings-default-currency').value;
  const budgetAmount = parseAmountValue($('settings-budget').value);
  if(name) userData.name = name;
  userData.defaultCurrency = currency;
  if(budgetAmount > 0){
    userData.budgets[selectedMonth] = { amount: budgetAmount, currency };
  }
  saveUser();
  renderAll();
  alert('تم حفظ التعديلات.');
}

function openModal(mode){
  $('modal').classList.add('active');
  $('modal').setAttribute('aria-hidden', 'false');
  $('transaction-form').classList.remove('active');
  $('budget-form').classList.remove('active');
  $('month-form').classList.remove('active');

  if(mode === 'income' || mode === 'expense'){
    $('modal-title').textContent = mode === 'income' ? 'إضافة دخل' : 'إضافة مصروف';
    $('transaction-form').classList.add('active');
    $('transaction-id').value = '';
    $('transaction-type').value = mode;
    $('transaction-title').value = '';
    $('transaction-amount').value = '';
    $('transaction-currency').innerHTML = currencyOptions(userData.defaultCurrency);
    $('transaction-category').innerHTML = categoryOptions(mode);
    $('transaction-date').value = selectedMonth === getCurrentMonth() ? today() : `${selectedMonth}-01`;
    $('transaction-note').value = '';
  }

  if(mode === 'budget'){
    const budget = userData.budgets[selectedMonth] || { amount: '', currency: userData.defaultCurrency };
    $('modal-title').textContent = `ميزانية ${monthName(selectedMonth)}`;
    $('budget-form').classList.add('active');
    $('budget-amount').value = budget.amount;
    $('budget-currency').innerHTML = currencyOptions(budget.currency);
  }

  if(mode === 'month'){
    $('modal-title').textContent = 'إضافة / فتح شهر';
    $('month-form').classList.add('active');
    $('new-month').value = selectedMonth;
  }
}

function closeModal(){
  $('modal').classList.remove('active');
  $('modal').setAttribute('aria-hidden', 'true');
}

function saveTransaction(event){
  event.preventDefault();
  const id = $('transaction-id').value || uid();
  const type = $('transaction-type').value;
  const date = $('transaction-date').value;
  const tx = {
    id,
    type,
    title: $('transaction-title').value.trim(),
    amount: parseAmountValue($('transaction-amount').value),
    currency: $('transaction-currency').value,
    category: $('transaction-category').value,
    date,
    note: $('transaction-note').value.trim(),
    createdAt: new Date().toISOString()
  };
  if(!tx.title || tx.amount <= 0 || !tx.date) return;
  const idx = userData.transactions.findIndex(t => t.id === id);
  if(idx >= 0){
    tx.createdAt = userData.transactions[idx].createdAt || tx.createdAt;
    userData.transactions[idx] = tx;
  }else{
    userData.transactions.push(tx);
  }
  selectedMonth = date.slice(0,7);
  ensureMonth(selectedMonth);
  saveUser();
  closeModal();
  renderAll();
}

function editTransaction(id){
  const tx = userData.transactions.find(t => t.id === id);
  if(!tx) return;
  openModal(tx.type);
  $('modal-title').textContent = tx.type === 'income' ? 'تعديل دخل' : 'تعديل مصروف';
  $('transaction-id').value = tx.id;
  $('transaction-type').value = tx.type;
  $('transaction-title').value = tx.title;
  $('transaction-amount').value = tx.amount;
  $('transaction-currency').innerHTML = currencyOptions(tx.currency);
  $('transaction-category').innerHTML = categoryOptions(tx.type, tx.category);
  $('transaction-date').value = tx.date;
  $('transaction-note').value = tx.note || '';
}

function deleteTransaction(id){
  if(!confirm('هل تريد حذف هذه العملية؟')) return;
  userData.transactions = userData.transactions.filter(t => t.id !== id);
  saveUser();
  renderAll();
}

function saveBudget(event){
  event.preventDefault();
  const amount = parseAmountValue($('budget-amount').value);
  const currency = $('budget-currency').value;
  userData.budgets[selectedMonth] = { amount, currency };
  saveUser();
  closeModal();
  renderAll();
}

function showPage(page){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $(`page-${page}`).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  renderAll();
}

function boot(){
  $('settings-default-currency').innerHTML = currencyOptions('EGP');
  const current = localStorage.getItem(STORAGE_CURRENT);
  const users = readUsers();
  if(current && users[current]){
    currentEmail = current;
    userData = users[current].data;
    selectedMonth = getCurrentMonth();
    ensureMonth(selectedMonth);
    if(userData.onboarded) openApp();
    else showOnboarding();
  }else{
    $('auth-screen').classList.add('active');
  }

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
