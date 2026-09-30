// Todas las piezas de la serie. Para sumar una, exportar sus `salidas` acá.
import { salidas as bajada } from './bajada.js';
import { salidas as entreDosRios } from './entre-dos-rios.js';
import { salidas as vinetas } from './vinetas.js';

export const PIEZAS = [...bajada, ...entreDosRios, ...vinetas];
