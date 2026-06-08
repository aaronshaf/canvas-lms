# spec/controllers — Migration Notice

All controller specs in this directory are being
converted to request specs and relocated to
`spec/requests/`.

Request specs make real HTTP calls through the
Rails router, catching routing bugs that controller
specs silently mask. Controller specs have also been
deprecated by the Rails maintainers.

**No new files or changes should be made here.**
Add new specs to `spec/requests/` instead.
