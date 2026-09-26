-- =====================================================================
-- Datos semilla: Legajo 299113 (causa Vialidad)
-- Solo datos que figuran en el prompt maestro (Drive de la UFIL al
-- 26/09/2026). Lo que falta queda vacío: la app lo muestra como [completar].
-- Se puede correr más de una vez: no duplica.
-- =====================================================================

insert into public.causa (legajo_fiscalia, numero_oga, caratula, delitos, objeto, observaciones)
values (
  '299113',
  '34445',
  'NN S/ FRAUDE A LA ADMINISTRACIÓN PÚBLICA (DENUNCIA DE DONDA EXEQUIEL MATÍAS)',
  'Fraude a la administración pública',
  'Sobreprecios, direccionamiento y dádivas en contrataciones de la Dirección Provincial de Vialidad (DPV).',
  'Contrataciones investigadas: [completar listado; según lo trabajado serían 16].'
)
on conflict (legajo_fiscalia) do nothing;

insert into public.acto_procesal (causa_id, fecha, tipo, titulo, descripcion)
select c.id, v.fecha, 'allanamiento', 'Allanamientos', v.descripcion
  from public.causa c
 cross join (values
   (date '2025-10-28', 'DPV, domicilios y comercios en Paraná, Santa Fe, Córdoba y CABA.'),
   (date '2026-08-10', 'Seis procedimientos.')
 ) as v (fecha, descripcion)
 where c.legajo_fiscalia = '299113'
   and not exists (
     select 1 from public.acto_procesal a
      where a.causa_id = c.id and a.tipo = 'allanamiento' and a.fecha = v.fecha);

insert into public.contratacion (causa_id, identificador, expediente)
select c.id, 'LP 05/2020', '154782'
  from public.causa c
 where c.legajo_fiscalia = '299113'
   and not exists (
     select 1 from public.contratacion k where k.causa_id = c.id and k.identificador = 'LP 05/2020');
