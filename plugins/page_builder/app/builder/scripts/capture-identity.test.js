"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const {sourceFingerprint}=require('./capture-identity');

test('Cloudflare email tokens do not create additional pages',()=>{
 const first='<a href="/cdn-cgi/l/email-protection#01234" data-cfemail="01234">Email</a>';
 const second='<a href="/cdn-cgi/l/email-protection#abcde" data-cfemail="abcde">Email</a>';
 assert.equal(sourceFingerprint(first,'<main>Home</main>'),sourceFingerprint(second,'<main>Home</main>'));
});
test('different rendered SPA screens are distinct despite a shared source shell',()=>{
 const source='<div id="root"></div><script src="/app.js"></script>';
 assert.notEqual(sourceFingerprint(source,'<div id="root">Customers</div>'),sourceFingerprint(source,'<div id="root">Conversations</div>'));
});
test('different source behavior remains distinct even when text matches',()=>{
 assert.notEqual(sourceFingerprint('<script src="/one.js"></script>','Home'),sourceFingerprint('<script src="/two.js"></script>','Home'));
});
