const test = require('node:test');
const assert = require('node:assert');
const miniEjs = require('./mini-ejs');

test('should print a variable in a simple template', () => {
  let output = miniEjs("Hello, <%= name %>!", { name: "World" });
  assert.equal(output, 'Hello, World!');
});

test('should handle an if statement', () => {
  let template = "Hello<% if (name) { %>, <%=name%><% } %>!"

  assert.equal(miniEjs(template, { name: "World" }), 'Hello, World!');
  assert.equal(miniEjs(template, { name: "" }), 'Hello!');
});

test('should trim whitespace to the right in <%= x -%>', () => {
  assert.equal(
    miniEjs('<%=foo%>   Bar', { foo: "Foo"}),
    'Foo   Bar'
  )
  assert.equal(
    miniEjs('<%=foo-%>   Bar', { foo: "Foo"}),
    'FooBar'
  )
});

test('should trim whitespace to the right in <% x -%>', () => {
  assert.equal(
    miniEjs('Foo <% if (true) {} %> Bar', { foo: "Foo"}),
    'Foo  Bar'
  )
  assert.equal(
    miniEjs('Foo <% if (true) {} -%> Bar', { foo: "Foo"}),
    'Foo Bar'
  )
});

test('should trim whitespace to the left in <%-= x %>', () => {
  assert.equal(
    miniEjs('Bar   <%=foo%>', { foo: "Foo"}),
    'Bar   Foo'
  )
  assert.equal(
    miniEjs('Bar   <%-=foo%>', { foo: "Foo"}),
    'BarFoo'
  )
});

test('should trim whitespace to the left in <%- x %>', () => {
  assert.equal(
    miniEjs('Foo  <% if (true) {} %> Bar', { foo: "Foo"}),
    'Foo   Bar'
  )
  assert.equal(
    miniEjs('Foo  <%- if (true) {} %> Bar', { foo: "Foo"}),
    'Foo Bar'
  )
});

test('should trim whitespace to either side in <%-= x -%>', () => {
  assert.equal(
    miniEjs('Bar <%=foo%> Baz', { foo: "Foo"}),
    'Bar Foo Baz'
  )
  assert.equal(
    miniEjs('Bar <%-=foo-%> Baz', { foo: "Foo"}),
    'BarFooBaz'
  )
});

test('should trim whitespace to either side in <%- x -%>', () => {
  assert.equal(
    miniEjs('Foo <% if (true) {} %> Bar', { foo: "Foo"}),
    'Foo  Bar'
  )
  assert.equal(
    miniEjs('Foo  <%- if (true) {} -%> Bar', { foo: "Foo"}),
    'FooBar'
  )
});

test('should handle an opening left trim <%- x %>', () => {
  assert.equal(
    miniEjs('<%- if (true) {} %>Foo', { foo: "Foo"}),
    'Foo'
  )
});

test('should handle an ending right trim <% x -%>', () => {
  assert.equal(
    miniEjs('Foo<% if (true) {} -%>', { foo: "Foo"}),
    'Foo'
  )
});

test('should handle an opening left trim <%-= x %>', () => {
  assert.equal(
    miniEjs('<%-=foo%>Foo', { foo: "Foo"}),
    'FooFoo'
  )
});

test('should handle an ending right trim <%= x -%>', () => {
  assert.equal(
    miniEjs('Foo<%=foo -%>', { foo: "Foo"}),
    'FooFoo'
  )
});

test('should handle opposed trimming right trim <%= x -%><%-= x %>', () => {
  assert.equal(
    miniEjs('<%=foo -%><%-=foo %>', { foo: "Foo"}),
    'FooFoo'
  )
});

test('should handle opposed trimming right trim <% x -%><%- x %>', () => {
  assert.equal(
    miniEjs('X<% if (foo) {} -%><%- if (foo) {} %>X', { foo: "Foo"}),
    'XX'
  )
});

test('should handle new lines', () => {
  let template = `
    <%- %>Foo
    <%  -%>
  `;

  assert.equal(
    miniEjs(template),
    'Foo\n    '
  )
});

test('should handle quotes', () => {
  assert.equal(miniEjs(`What "Foo" Bar`), `What "Foo" Bar`)
});

