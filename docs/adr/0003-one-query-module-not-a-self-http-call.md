# The review page calls the query layer, not its own API

The brief asks for both a submissions API and a server-rendered review page, and
filter state lives in the URL — so changing a filter is a navigation that
re-renders on the server. Rather than have the page fetch its own HTTP endpoint,
both the route handler and the page call one shared query function: the handler
is a thin validate-and-serialise wrapper, the page calls it directly.

## Consequences

A reader who expects the page to consume the documented API will not find that
call, so it is stated plainly in the README. In exchange there is no loopback
request, no absolute-URL construction, no double serialisation, and exactly one
place where the listing query, its filters and its index usage can be wrong.
