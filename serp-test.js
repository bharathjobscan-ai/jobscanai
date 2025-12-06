import fetch from 'node-fetch';
const key = process.env.SERPAPI_KEY;
const q = 'google careers';
const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&engine=google&api_key=${key}`;
const res = await fetch(url);
console.log(await res.json());
