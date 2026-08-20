# pyrefly: ignore [missing-import]
import duckdb
con = duckdb.connect("database/AmaziaERP.db", read_only=True)
res = con.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='inventory_table'").fetchall()
print("SCHEMA:", res)
