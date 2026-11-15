# Prototype UI patterns (from rendered DOM)

## App shell (body children order, client-dashboard)
(not found: <body[^>]*>)

## Tabs (client-enquiries)


## Table (staff-cases)
<table class="w-full text-left text-sm">
<thead>
<tr class="border-b border-brand-100 text-xs uppercase tracking-wide text-ink-muted">
<th class="whitespace-nowrap px-4 py-3 font-medium">
<button class="inline-flex items-center gap-1 hover:text-brand-800">Case</button>
</th>
<th class="whitespace-nowrap px-4 py-3 font-medium">Property</th>
<th class="whitespace-nowrap px-4 py-3 font-medium">
<button class="inline-flex items-center gap-1 hover:text-brand-800">Buyer / Renter</button>
</th>
<th class="whitespace-nowrap px-4 py-3 font-medium">
<button class="inline-flex items-center gap-1 hover:text-brand-800">Submitted</button>
</th>
<th class="whitespace-nowrap px-4 py-3 font-medium">Status</th>
<th class="whitespace-nowrap px-4 py-3 font-medium">
<button class="inline-flex items-center gap-1 hover:text-brand-800">Lawyer</button>
</th>
<th class="whitespace-nowrap px-4 py-3 font-medium" aria-sort="descending">
<button class="inline-flex items-center gap-1 hover:text-brand-800">Last activity[svg]
</button>
</th>
</tr>
</thead>

Table body row:
<tbody>
<tr class="border-b border-brand-50 last:border-0 cursor-pointer hover:bg-brand-50/50">
<td class="px-4 py-3 align-middle">
<div>
<p class="font-medium text-ink-strong">ELV-CS-2001</p>
<p class="text-xs text-ink-muted">ELV-EQ-4001</p>
</div>
</td>
<td class="px-4 py-3 align-middle">
<span class="line-clamp-1 max-w-[220px]">Contemporary 4-Bedroom Detached Duplex</span>
</td>
<td class="px-4 py-3 align-middle">Daniel Johnson</td>
<td class="px-4 py-3 align-middle">
<span class="whitespace-nowrap text-ink-muted">3 Nov 2026</span>
</td>
<td class="px-4 py-3 align-middle">
<div class="flex flex-wrap items-center justify-end gap-1 md:justify-start">
<span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset bg-brand-50 text-brand-800 ring-brand-200">
<span class="h-1.5 w-1.5 rounded-full bg-brand-500">
</span>In Progress</span>
</div>
</td>
<td class="px-4 py-3 align-middle">Adaeze Okonkwo</td>
<td class="px-4 py-3 align-middle">
<span class="whitespace-nowrap text-ink-muted">6 Nov 2026</span>
</td>
</tr>
<tr class="border-b border-brand-50 last:border-0 cursor-pointer hover:bg-brand-50/50">
<td class="px-4 py-3 align-middle">
<div>

## Stepper/timeline dots (client-enquiry-detail)
absolute -left-6 top-1 h-[15px] w-[15px] rounded-full border-2 border-white ring-1 bg-brand-600 ring-brand-200

## Thread messages (client-enquiry-detail)
Messages with the ELVICTORIA legal team</h3>
<p class="mt-0.5 text-sm text-ink-muted">Ask questions or share information. Your lawyer coordinates with the property provider for you.</p>
</div>
</div>
<div class="p-5">
<div>
<ul class="space-y-3">
<li class="flex gap-3 flex-row-reverse">
<span aria-hidden="true" class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white bg-brand-700 h-7 w-7 text-2xs">DJ</span>
<div class="max-w-[85%] rounded-xl px-4 py-2.5 text-sm bg-brand-800 text-white">
<p class="mb-0.5 text-xs font-semibold text-brand-100">Daniel Johnson</p>
<p class="whitespace-pre-line">I am interested in purchasing this property for my family. I would like to arrange an inspection and understand the title position before making an offer.</p>
<p class="mt-1 text-2xs text-brand-200">3 Nov 2026, 09:12</p>
</div>
</li>
<li class="flex gap-3">
<span aria-hidden="true" class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white bg-brand-700 h-7 w-7 text-2xs">AO</span>
<div class="max-w-[85%] rounded-xl px-4 py-2.5 text-sm bg-brand-50">
<p class="mb-0.5 text-xs font-semibold text-brand-700">Adaeze Okonkwo<span class="font-normal opacity-80"> · ELVICTORIA Legal</span>
</p>
<p class="whitespace-pre-line">Dear Daniel, the developer has confirmed an inspection on Saturday 8 November from 11am. I will attend with you and arrange for the title to be sighted afterwards.</p>
<p class="mt-1 text-2xs text-ink-muted">6 Nov 2026, 09:18</p>
</div>
</li>
<li class="flex gap-3 flex-row-reverse">
<span aria-hidden="true" class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white bg-brand-700 h-7 w-7 text-2xs">DJ</span>
<div class="max-w-[85%] rounded-xl px-4 py-2.5 text-sm bg-brand-800 text-white">
<p class="mb-0.5 text-xs font-semibold text-brand-100">Daniel Johnson</p>
<p class="whitespace-pre-line">Thank you, Saturday works for me. I will come with my wife.</p>
<p class="mt-1 text-2xs text-brand-200">6 Nov 2026, 10:02</p>
</div>
</li>
<li class="flex gap-3">
<span aria-hidden="true" class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white bg-brand-700 h-7 w-7 text-2xs">AO</span>
<div class="max-w-[85%] rounded-xl px-4 py-2.5 text-sm bg-brand-50">
<p class="mb-0.5 text-xs font-semibold text-brand-700">Adaeze Okonkwo<span class="font-normal opacity-80"> · ELVICTORIA Legal</span>
</p>
<p class="whitespace-pre-line">Noted. I will meet you at the property gate at 10:50am on Saturday.</p>
<p class="mt-1 text-2xs text-ink-muted">6 Nov 2026, 10:20</p>
</div>
</li>
</ul>
<div class="mt-4 rounded-xl border border-brand-100 bg-white p-2">
<label for="compose-client" class="sr-only">Message to Client</label>
<textarea class="input min-h-[96px] resize-y min-h-[72px] border-0 focus:ring-0" id="compose-client" placeholder="Write a message to the legal team…">
</textarea>
<div class="flex items-center justify-between gap-2 px-1 pt-1">
<span class="text-xs text-ink-muted">Ctrl/⌘ + Enter to send</span>
<button type="button" disabled="" class="inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 bg-brand-800 text-white hover:bg-brand-700 shadow-sm h-9 px-3 text-sm gap-1.5">
[svg]Send</button>

## Button variants across screens
### bg-brand-800 text-white
inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 bg-brand-800 text-white hover:bg-brand-700 shadow-sm h-10 px-4 text-sm gap-2
inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 bg-brand-800 text-white hover:bg-brand-700 shadow-sm h-12 px-6 text-base gap-2 w-full
inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition bg-brand-800 text-white
max-w-[85%] rounded-xl px-4 py-2.5 text-sm bg-brand-800 text-white
inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 bg-brand-800 text-white hover:bg-brand-700 shadow-sm h-9 px-3 text-sm gap-1.5
inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 bg-brand-800 text-white hover:bg-brand-700 shadow-sm h-10 px-4 text-sm gap-2
### bg-gold-400 
absolute left-3 top-3 rounded-md px-2 py-1 text-xs font-semibold shadow-sm bg-gold-400 text-brand-950
rounded-full bg-gold-400 px-1.5 text-2xs font-semibold text-brand-950
### border-brand-300


### bg-red-600

absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-2xs font-semibold text-white
### text-brand-700 hover:bg-brand-50
inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 text-brand-700 hover:bg-brand-50 h-10 px-4 text-sm gap-2
inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 text-brand-700 hover:bg-brand-50 h-9 px-3 text-sm gap-1.5
### bg-emerald-600


### bg-white text
inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition border-brand-200 bg-white text-brand-800 hover:bg-brand-50
inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 bg-white text-brand-800 border border-brand-200 hover:bg-brand-50 h-10 px-4 text-sm gap-2
relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold border-brand-100 bg-white text-ink-muted
inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 bg-white text-brand-800 border border-brand-200 hover:bg-brand-50 h-10 px-4 text-sm gap-2 w-full

## Page header block (staff-dashboard h1 area)
<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
<div>
<div class="mb-6">
<div class="flex flex-wrap items-end justify-between gap-4">
<div class="min-w-0">
<h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Good day, Adaeze</h1>
<p class="mt-1.5 max-w-2xl text-base text-ink-soft">You are handling 3 open matters. 11 matters need attention across the platform.</p>
</div>
</div>
</div>
<div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
<a class="block rounded-xl border border-brand-100/80 bg-white p-4 shadow-card transition hover:border-brand-200 hover:shadow-lift" href="/app/staff/listings">
<div class="flex items-start justify-between gap-3">
<div class="min-w-0">
<p class="text-sm text-ink-muted">Total listings

## Stat tile with icon tile (staff-dashboard)
Total listings</p>
<p class="mt-1.5 text-2xl font-semibold tracking-tight text-ink-strong">25</p>
<p class="mt-1 text-xs text-ink-muted">Excludes provider drafts</p>
</div>
<span class="rounded-lg p-2 bg-brand-50 text-brand-700">
[svg]
</span>
</div>
</a>
<a class="block rounded-xl border border-brand-100/80 bg-white p-4 shadow-card transition hover:border-brand-200 hover:shadow-lift" href="/app/staff/listings?status=pending_review">
<div class="flex items-start justify-between gap-3">
<div class="min-w-0">
<p class="text-sm text-ink-muted">Pending approvals

## Login card (login.html)
(not found: <main)

## Mobile bottom nav (client-dashboard)
(not found: safe-area-inset-bottom)