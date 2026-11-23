# KEYGUARD backend (Phase 4 — Flask + Jinja2)

A standalone Flask application: server-rendered HTML pages, forms, and
a Python service layer with the business rules. This is **not yet wired
to the React app** in the rest of this repo — it runs on its own, as a
separate, complete front end.

## Run it

    cd backend
    pip install -r requirements.txt
    flask --app app run

Then open http://127.0.0.1:5000/

Sample data is generated automatically in `backend/data/` on first run
(dates relative to the current time, so Overdue/Due-soon always have
something to show).

## Run the tests

    cd backend
    python -m unittest discover -s tests -v

18 tests covering normal, boundary, and failure cases.

## Layout

    app.py              Flask routes only (no business rules)
    service.py           KeyService — business rules + JSON persistence
    exceptions.py         Custom exceptions, shown via flash()
    seed.py               Sample data generator (relative to "now")
    templates/            Jinja2 templates, one per page
    static/style.css       Plain CSS, no frameworks
    tests/test_service.py   Unit tests
    data/                 Created on first run (gitignored)

## Routes

    GET  /                      Dashboard
    GET  /keys                  Key inventory
    GET  POST /keys/register    Register a key
    GET  POST /issue            Issue a key
    GET  POST /return           Return a key
    POST /return/<reference>    One-click return from a table row
    GET  /issued                Currently issued keys
    GET  /overdue               Overdue report
    GET  /due-soon              Due within 30 minutes
    GET  /search?q=             Search
    GET  /history               Transactions + audit log
    POST /admin/reset-demo      Regenerate sample data
