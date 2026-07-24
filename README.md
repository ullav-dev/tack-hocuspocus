# tack-hocuspocus

Self-hosted [Hocuspocus](https://tiptap.dev/docs/hocuspocus) real-time Yjs sync server for [Tack](https://github.com/ullav-dev/tack-server)'s Pages content type.

Handles real-time collaborative editing sync for Pages: authenticates each connection against `tack-server`'s live-resolved page permissions, and persists/loads Yjs document state directly to/from the same Postgres database `tack-server` uses.

See `CLAUDE.md` for architecture details.
