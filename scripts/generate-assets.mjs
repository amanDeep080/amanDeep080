/**

Self-hosted SVG assets (no third-party cards):

heatmap-(dark|light).svg

impact-(dark|light).svg

achievements-(dark|light).svg

performance-(dark|light).svg

Uses GitHub GraphQL + REST via GITHUB_TOKEN.
*/

const USERNAME = process.env.GH_USERNAME || "amanDeep080";
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
console.error("Missing GITHUB_TOKEN env var.");
process.exit(1);
}

const api = async (url, opts = {}) => {
const res = await fetch(url, {
...opts,
headers: {
"Authorization": Bearer ${TOKEN},
"Accept": "application/vnd.github+json",
...(opts.headers || {}),
},
});
if (!res.ok) {
const txt = await res.text().catch(() => "");
throw new Error(${res.status} ${res.statusText}: ${txt.slice(0, 300)});
}
return res.json();
};

const gql = async (query, variables = {}) => {
const data = await api("https://api.github.com/graphql
", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ query, variables }),
});
if (data.errors?.length) throw new Error(JSON.stringify(data.errors[0]));
return data.data;
};

const esc = (s) =>
String(s).replaceAll("&", "&").replaceAll("<", "<").replaceAll(">", ">").replaceAll('"', """);

const fmt = (n) => {
const num = Number(n) || 0;
if (num >= 1_000_000) return ${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M;
if (num >= 1_000) return ${(num / 1_000).toFixed(1).replace(/\.0$/, "")}k;
return ${num};
};

const nowYear = new Date().getFullYear();

async function fetchUserBasics() {
const u = await api(https://api.github.com/users/${USERNAME});
return {
followers: u.followers ?? 0,
publicRepos: u.public_repos ?? 0,
following: u.following ?? 0,
};
}

async function fetchRepoTotals() {
// GraphQL pagination to sum stars + forks across repos
let hasNextPage = true;
let cursor = null;
let stars = 0;
let forks = 0;
let reposCount = 0;

const Q = query($login: String!, $cursor: String) { user(login: $login) { repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, isFork: false, orderBy: {field: UPDATED_AT, direction: DESC}) { totalCount pageInfo { hasNextPage endCursor } nodes { stargazerCount forkCount } } } } ;

while (hasNextPage) {
const d = await gql(Q, { login: USERNAME, cursor });
const r = d.user.repositories;
reposCount = r.totalCount;
for (const node of r.nodes) {
stars += node.stargazerCount || 0;
forks += node.forkCount || 0;
}
hasNextPage = r.pageInfo.hasNextPage;
cursor = r.pageInfo.endCursor;
}

return { stars, forks, reposCount };
}

async function fetchContributionCalendar() {
const Q = query($login: String!) { user(login: $login) { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount weekday } } } } } } ;
const d = await gql(Q, { login: USERNAME });
const cal = d.user.contributionsCollection.contributionCalendar;
return cal;
}

function colorFor(count, theme) {
// GitHub-ish palette (self-contained)
const dark = theme === "dark";
const zero = dark ? "#121826" : "#EEF2F7";
const c1 = dark ? "#0e4429" : "#9BE9A8";
const c2 = dark ? "#006d32" : "#40C463";
const c3 = dark ? "#26a641" : "#30A14E";
const c4 = dark ? "#39d353" : "#216E39";

if (count <= 0) return zero;
if (count <= 2) return c1;
if (count <= 6) return c2;
if (count <= 12) return c3;
return c4;
}

function renderHeatmapSvg(cal, theme) {
const bg = theme === "dark" ? "#0B1020" : "#FFFFFF";
const card = theme === "dark" ? "#0F172A" : "#F8FAFC";
const text = theme === "dark" ? "#E5E7EB" : "#0F172A";
const sub = theme === "dark" ? "#9CA3AF" : "#475569";
const stroke = theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(2,6,23,0.08)";

const size = 11;
const gap = 3;
const pad = 18;
const top = 46;
const left = 18;

const weeks = cal.weeks;
const cols = weeks.length; // usually 53
const width = pad * 2 + left + cols * (size + gap) + 10;
const height = pad * 2 + top + 7 * (size + gap) + 18;

let rects = "";
for (let x = 0; x < weeks.length; x++) {
const days = weeks[x].contributionDays;
for (const d of days) {
const y = d.weekday; // 0..6
const cx = left + x * (size + gap);
const cy = top + y * (size + gap);
rects += <rect x="${cx}" y="${cy}" width="${size}" height="${size}" rx="2" fill="${colorFor(d.contributionCount, theme)}"> <title>${esc(d.date)} • ${d.contributionCount} contributions</title> </rect>;
}
}

return <?xml version="1.0" encoding="UTF-8"?> <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Contribution heatmap"> <rect x="0" y="0" width="${width}" height="${height}" rx="16" fill="${bg}"/> <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="14" fill="${card}" stroke="${stroke}"/> <text x="28" y="38" fill="${text}" font-size="16" font-family="Inter, ui-sans-serif, system-ui">Contribution Heatmap</text> <text x="${width - 28}" y="38" text-anchor="end" fill="${sub}" font-size="12" font-family="Inter, ui-sans-serif, system-ui">${fmt(cal.totalContributions)} total</text> ${rects} </svg>;
}

function renderImpactSvg(metrics, theme) {
const bg = theme === "dark" ? "#0B1020" : "#FFFFFF";
const card = theme === "dark" ? "#0F172A" : "#F8FAFC";
const text = theme === "dark" ? "#E5E7EB" : "#0F172A";
const sub = theme === "dark" ? "#9CA3AF" : "#475569";
const stroke = theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(2,6,23,0.08)";

const items = [
["Followers", fmt(metrics.followers)],
["Stars", fmt(metrics.stars)],
["Forks", fmt(metrics.forks)],
["Public Repos", fmt(metrics.publicRepos)],
[Commits (${nowYear}), fmt(metrics.commitsThisYear)],
["Total Contributions", fmt(metrics.totalContrib)],
];

const W = 980, H = 160;
const cols = 3;
const cellW = Math.floor((W - 60) / cols);
const cellH = 44;

let blocks = "";
items.forEach(([k, v], i) => {
const r = Math.floor(i / cols);
const c = i % cols;
const x = 20 + c * cellW;
const y = 56 + r * cellH;

blocks += `
  <rect x="${x}" y="${y}" width="${cellW - 14}" height="${cellH - 12}" rx="12" fill="${theme === "dark" ? "rgba(0,247,255,0.06)" : "rgba(2,6,23,0.04)"}" stroke="${stroke}"/>
  <text x="${x + 14}" y="${y + 20}" fill="${sub}" font-size="12" font-family="Inter, ui-sans-serif, system-ui">${esc(k)}</text>
  <text x="${x + 14}" y="${y + 38}" fill="${text}" font-size="18" font-weight="600" font-family="Inter, ui-sans-serif, system-ui">${esc(v)}</text>
`;


});

return <?xml version="1.0" encoding="UTF-8"?> <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Open source impact"> <rect width="${W}" height="${H}" rx="16" fill="${bg}"/> <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="14" fill="${card}" stroke="${stroke}"/> <text x="28" y="42" fill="${text}" font-size="16" font-family="Inter, ui-sans-serif, system-ui">Open Source Impact</text> ${blocks} </svg>;
}

function renderAchievementsSvg(metrics, theme) {
const bg = theme === "dark" ? "#0B1020" : "#FFFFFF";
const card = theme === "dark" ? "#0F172A" : "#F8FAFC";
const stroke = theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(2,6,23,0.08)";
const text = theme === "dark" ? "#E5E7EB" : "#0F172A";
const sub = theme === "dark" ? "#9CA3AF" : "#475569";

// Simple dynamic achievements based on metrics
const badges = [];
if (metrics.commitsThisYear >= 100) badges.push(["Consistency", "100+ commits", "#00F7FF"]);
else badges.push(["Consistency", ${metrics.commitsThisYear} commits, "#00F7FF"]);

if (metrics.stars >= 10) badges.push(["Community", "10+ stars", "#FF00FF"]);
else badges.push(["Community", ${metrics.stars} stars, "#FF00FF"]);

if (metrics.publicRepos >= 10) badges.push(["Builder", "10+ repos", "#00F7FF"]);
else badges.push(["Builder", ${metrics.publicRepos} repos, "#00F7FF"]);

badges.push(["Shipping", "CI enabled", "#22C55E"]);

const W = 980, H = 92;
const pad = 20;
const gap = 14;
const badgeW = Math.floor((W - pad * 2 - gap * 3) / 4);
const badgeH = 44;

let out = "";
badges.forEach(([title, value, accent], i) => {
const x = pad + i * (badgeW + gap);
const y = 32;
out += <rect x="${x}" y="${y}" width="${badgeW}" height="${badgeH}" rx="14" fill="${theme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(2,6,23,0.03)"}" stroke="${stroke}"/> <rect x="${x}" y="${y}" width="6" height="${badgeH}" rx="3" fill="${accent}"/> <text x="${x + 18}" y="${y + 18}" fill="${sub}" font-size="12" font-family="Inter, ui-sans-serif, system-ui">${esc(title)}</text> <text x="${x + 18}" y="${y + 36}" fill="${text}" font-size="14" font-weight="600" font-family="Inter, ui-sans-serif, system-ui">${esc(value)}</text> ;
});

return <?xml version="1.0" encoding="UTF-8"?> <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Achievements"> <rect width="${W}" height="${H}" rx="16" fill="${bg}"/> <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="14" fill="${card}" stroke="${stroke}"/> <text x="28" y="36" fill="${text}" font-size="16" font-family="Inter, ui-sans-serif, system-ui">Achievements</text> ${out} </svg>;
}

function computeGrade(metrics) {
// A+ style score from 0..100 (simple but effective)
// weights: commits 40, stars 20, repos 15, followers 15, forks 10
const c = Math.min(40, (metrics.commitsThisYear / 200) * 40);
const s = Math.min(20, (metrics.stars / 50) * 20);
const r = Math.min(15, (metrics.publicRepos / 20) * 15);
const f = Math.min(15, (metrics.followers / 50) * 15);
const k = Math.min(10, (metrics.forks / 20) * 10);
const score = Math.round(c + s + r + f + k);
const grade =
score >= 95 ? "A+" :
score >= 90 ? "A" :
score >= 85 ? "A-" :
score >= 80 ? "B+" :
score >= 75 ? "B" :
score >= 70 ? "B-" :
score >= 60 ? "C" : "D";
return { score, grade };
}

function renderPerformanceSvg(metrics, theme) {
const bg = theme === "dark" ? "#0B1020" : "#FFFFFF";
const card = theme === "dark" ? "#0F172A" : "#F8FAFC";
const stroke = theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(2,6,23,0.08)";
const text = theme === "dark" ? "#E5E7EB" : "#0F172A";
const sub = theme === "dark" ? "#9CA3AF" : "#475569";
const accent = theme === "dark" ? "#00F7FF" : "#0EA5E9";
const accent2 = theme === "dark" ? "#FF00FF" : "#7C3AED";

const { score, grade } = computeGrade(metrics);
const W = 980, H = 170;

const ringCx = 820, ringCy = 92;
const r = 34;
const circumference = 2 * Math.PI * r;
const progress = Math.max(0.05, Math.min(1, score / 100));
const dash = ${(circumference * progress).toFixed(2)} ${(circumference * (1 - progress)).toFixed(2)};

return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Performance">
<defs>
<linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${accent}"/>
<stop offset="100%" stop-color="${accent2}"/>
</linearGradient>
</defs>

<rect width="${W}" height="${H}" rx="16" fill="${bg}"/> <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="14" fill="${card}" stroke="${stroke}"/>

<text x="28" y="44" fill="${text}" font-size="16" font-family="Inter, ui-sans-serif, system-ui">Performance</text>
<text x="28" y="72" fill="${sub}" font-size="13" font-family="Inter, ui-sans-serif, system-ui">
Score based on activity + OSS signals (commits, stars, repos, followers, forks)
</text>

<text x="28" y="114" fill="${sub}" font-size="12" font-family="Inter, ui-sans-serif, system-ui">Commits (${nowYear})</text>
<text x="28" y="138" fill="${text}" font-size="18" font-weight="600" font-family="Inter, ui-sans-serif, system-ui">${fmt(metrics.commitsThisYear)}</text>

<text x="220" y="114" fill="${sub}" font-size="12" font-family="Inter, ui-sans-serif, system-ui">Stars</text>
<text x="220" y="138" fill="${text}" font-size="18" font-weight="600" font-family="Inter, ui-sans-serif, system-ui">${fmt(metrics.stars)}</text>

<text x="360" y="114" fill="${sub}" font-size="12" font-family="Inter, ui-sans-serif, system-ui">Followers</text>
<text x="360" y="138" fill="${text}" font-size="18" font-weight="600" font-family="Inter, ui-sans-serif, system-ui">${fmt(metrics.followers)}</text>

<circle cx="${ringCx}" cy="${ringCy}" r="${r}" fill="none" stroke="${theme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(2,6,23,0.10)"}" stroke-width="10"/>
<circle cx="${ringCx}" cy="${ringCy}" r="${r}" fill="none" stroke="url(#grad)" stroke-width="10" stroke-linecap="round" transform="rotate(-90 ${ringCx} ${ringCy})" stroke-dasharray="${dash}"/>

<text x="${ringCx}" y="${ringCy - 2}" text-anchor="middle" fill="${text}" font-size="22" font-weight="700" font-family="Inter, ui-sans-serif, system-ui">${esc(grade)}</text>
<text x="${ringCx}" y="${ringCy + 22}" text-anchor="middle" fill="${sub}" font-size="12" font-family="Inter, ui-sans-serif, system-ui">${score}/100</text>
</svg>`;
}

async function main() {
const [basics, totals, cal] = await Promise.all([
fetchUserBasics(),
fetchRepoTotals(),
fetchContributionCalendar(),
]);

// commits this year: approximate from contribution calendar by summing dates that start with this year
const yearStr = String(nowYear);
let commitsThisYear = 0;
for (const w of cal.weeks) {
for (const d of w.contributionDays) {
if (d.date.startsWith(yearStr)) commitsThisYear += d.contributionCount;
}
}

const metrics = {
...basics,
stars: totals.stars,
forks: totals.forks,
publicRepos: basics.publicRepos,
totalContrib: cal.totalContributions,
commitsThisYear,
};

// Write assets to dist/
const fs = await import("node:fs/promises");
await fs.mkdir("dist", { recursive: true });

// Heatmaps
await fs.writeFile("dist/heatmap-dark.svg", renderHeatmapSvg(cal, "dark"), "utf8");
await fs.writeFile("dist/heatmap-light.svg", renderHeatmapSvg(cal, "light"), "utf8");

// Impact
await fs.writeFile("dist/impact-dark.svg", renderImpactSvg(metrics, "dark"), "utf8");
await fs.writeFile("dist/impact-light.svg", renderImpactSvg(metrics, "light"), "utf8");

// Achievements
await fs.writeFile("dist/achievements-dark.svg", renderAchievementsSvg(metrics, "dark"), "utf8");
await fs.writeFile("dist/achievements-light.svg", renderAchievementsSvg(metrics, "light"), "utf8");

// Performance
await fs.writeFile("dist/performance-dark.svg", renderPerformanceSvg(metrics, "dark"), "utf8");
await fs.writeFile("dist/performance-light.svg", renderPerformanceSvg(metrics, "light"), "utf8");

console.log("✅ Assets generated in dist/");
}

main().catch((e) => {
console.error("❌ Asset generation failed:", e);
process.exit(1);
});
