// ===== Modo demo =====
// Simula la API REST en memoria cuando el backend (Spring Boot) no está arrancado.
// Responde a las mismas rutas que la API real, así app.js no cambia.

const Demo = (() => {
  const videojuegos = [
    { id: 1, nombre: "Valorant", genero: "Shooter" },
    { id: 2, nombre: "League of Legends", genero: "MOBA" },
    { id: 3, nombre: "Rocket League", genero: "Deportes" }
  ];
  const jugadores = [
    { id: 1, nick: "ShadowFox", email: "shadow@arena.es", nivel: 42 },
    { id: 2, nick: "NovaStrike", email: "nova@arena.es", nivel: 35 },
    { id: 3, nick: "PixelQueen", email: "pixel@arena.es", nivel: 58 },
    { id: 4, nick: "IronByte", email: "iron@arena.es", nivel: 21 },
    { id: 5, nick: "Zephyr", email: "zephyr@arena.es", nivel: 12 }
  ];
  const torneos = [
    { id: 1, nombre: "Copa Invierno", fecha: "2026-12-12", premio: 1500, estado: "ABIERTO", videojuego: videojuegos[0] },
    { id: 2, nombre: "Liga Grieta", fecha: "2026-11-20", premio: 3000, estado: "EN_CURSO", videojuego: videojuegos[1] },
    { id: 3, nombre: "Turbo Cup", fecha: "2026-10-05", premio: 800, estado: "FINALIZADO", videojuego: videojuegos[2] },
    { id: 4, nombre: "Spike Masters", fecha: "2027-01-15", premio: 2500, estado: "ABIERTO", videojuego: videojuegos[0] },
    { id: 5, nombre: "Aerial Open", fecha: "2026-12-01", premio: 600, estado: "ABIERTO", videojuego: videojuegos[2] }
  ];
  const participaciones = [];
  [[1, 1], [2, 1], [3, 1], [1, 2], [3, 2], [4, 2], [2, 3], [5, 3], [3, 4], [4, 5]].forEach(([j, t], i) => {
    participaciones.push({ id: i + 1, jugador: jugadores[j - 1], torneo: torneos[t - 1], puntos: (i * 37) % 120, posicion: null });
  });

  const sig = lista => Math.max(0, ...lista.map(x => x.id)) + 1;
  const ok = (data, status = 200) => ({ status, data });
  const error = (status, mensaje) => ({ status, data: { mensaje } });
  const copia = x => JSON.parse(JSON.stringify(x));

  function rutas(metodo, ruta, cuerpo) {
    const p = ruta.split("/").filter(Boolean);   // ej. ["torneos", "videojuego", "1", "estado", "ABIERTO"]
    const id = Number(p[1]);

    // ---- Videojuegos ----
    if (p[0] === "videojuegos") {
      if (metodo === "GET" && p.length === 1) return ok(videojuegos);
      if (metodo === "GET" && p.length === 2) {
        const v = videojuegos.find(x => x.id === id);
        return v ? ok(v) : error(404, "No existe ese videojuego");
      }
      if (metodo === "POST") {
        const v = { id: sig(videojuegos), nombre: cuerpo.nombre, genero: cuerpo.genero };
        videojuegos.push(v);
        return ok(v, 201);
      }
    }

    // ---- Jugadores ----
    if (p[0] === "jugadores") {
      if (metodo === "GET" && p.length === 1) return ok(jugadores);
      const j = jugadores.find(x => x.id === id);
      if (p.length >= 2 && !j) return error(404, "No existe ese jugador");
      if (metodo === "GET" && p[2] === "participaciones") return ok(participaciones.filter(x => x.jugador.id === id));
      if (metodo === "GET") return ok(j);
      if (metodo === "POST") {
        const n = { id: sig(jugadores), ...cuerpo };
        jugadores.push(n);
        return ok(n, 201);
      }
      if (metodo === "PUT") { Object.assign(j, cuerpo, { id }); return ok(j); }
      if (metodo === "DELETE") {
        if (participaciones.some(x => x.jugador.id === id)) return error(409, "El jugador tiene participaciones y no se puede eliminar");
        jugadores.splice(jugadores.indexOf(j), 1);
        return ok(null, 204);
      }
    }

    // ---- Torneos ----
    if (p[0] === "torneos") {
      if (metodo === "GET" && p.length === 1) return ok(torneos);
      if (p[1] === "estado") return ok(torneos.filter(t => t.estado === p[2]));
      if (p[1] === "videojuego") {
        let r = torneos.filter(t => t.videojuego.id === Number(p[2]));
        if (p[3] === "estado") r = r.filter(t => t.estado === p[4]);
        return ok(r);
      }
      if (metodo === "POST") {
        const v = videojuegos.find(x => x.id === Number(cuerpo.videojuego?.id));
        if (!v) return error(400, "Un torneo necesita videojuego");
        const t = { id: sig(torneos), ...cuerpo, videojuego: v };
        torneos.push(t);
        return ok(t, 201);
      }
      const t = torneos.find(x => x.id === id);
      if (!t) return error(404, "No existe ese torneo");
      if (metodo === "GET" && p[2] === "participantes") return ok(participaciones.filter(x => x.torneo.id === id));
      if (metodo === "GET") return ok(t);
      if (metodo === "PUT") {
        const v = videojuegos.find(x => x.id === Number(cuerpo.videojuego?.id));
        if (!v) return error(400, "Un torneo necesita videojuego");
        Object.assign(t, cuerpo, { id, videojuego: v });
        return ok(t);
      }
      if (metodo === "DELETE") {
        if (participaciones.some(x => x.torneo.id === id)) return error(409, "El torneo tiene participaciones y no se puede eliminar");
        torneos.splice(torneos.indexOf(t), 1);
        return ok(null, 204);
      }
    }

    // ---- Participaciones ----
    if (p[0] === "participaciones" && metodo === "POST") {
      const j = jugadores.find(x => x.id === Number(cuerpo.jugador?.id));
      const t = torneos.find(x => x.id === Number(cuerpo.torneo?.id));
      if (!j || !t) return error(400, "Falta el jugador o el torneo");
      if (participaciones.some(x => x.jugador.id === j.id && x.torneo.id === t.id)) return error(409, "Ese jugador ya está inscrito en ese torneo");
      const n = { id: sig(participaciones), jugador: j, torneo: t, puntos: 0, posicion: null };
      participaciones.push(n);
      return ok(n, 201);
    }

    return error(404, "Ruta no encontrada");
  }

  // Simula la latencia de la red para que se vean las animaciones de carga
  return {
    peticion(metodo, ruta, cuerpo) {
      return new Promise(res => setTimeout(() => res(copia(rutas(metodo, ruta, cuerpo))), 250));
    }
  };
})();
