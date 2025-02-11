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
