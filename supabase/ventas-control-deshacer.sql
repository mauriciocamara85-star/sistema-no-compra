-- ═══ Deshacer el SQL 185 · Ventas: el control de carga de cada mañana (28/10/2026) ═══
-- Borra el control y la huella de la llave del mail. No toca nada de lo cargado en Ventas.
-- Después, el Apps Script "VDH · Control de carga" ya no puede armar el mail (le avisa a Mauricio):
-- apagarlo corriendo "desactivar" en el editor.

drop function if exists ventas_control_mail(text, date);
drop function if exists ventas_control(date);
drop function if exists ventas_ctl_lista(text[]);
drop function if exists ventas_ctl_dia(date);
drop function if exists ventas_ctl_num(numeric);
drop function if exists ventas_ctl_pesos(numeric);
drop table if exists ventas_control_llave;
