import { assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import { getExtent } from '@truckermudgeon/base/geom';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import type { Route, RouteDirection } from '@truckermudgeon/navigation/types';
import type { GeoJSONSource, Marker } from 'maplibre-gl';
import { action, makeAutoObservable, observable } from 'mobx';
import type { MapRef } from 'react-map-gl/maplibre';
import { CameraMode } from './constants';
import type { AppClient, AppController, AppStore } from './types';

export class AppStoreImpl implements AppStore {
  themeMode: 'light' | 'dark' = 'dark';
  cameraMode: CameraMode = CameraMode.FOLLOW;
  activeRoute: Route | undefined = undefined;
  activeRouteDirection: RouteDirection | undefined;
  trailerPoint: [lon: number, lat: number] | undefined;
  showNavSheet = false;

  constructor() {
    makeAutoObservable(this, {
      activeRoute: observable.ref,
      activeRouteDirection: observable.ref,
      trailerPoint: observable.ref,
    });
  }
}

export class AppControllerImpl implements AppController {
  private map: MapRef | undefined;
  private playerMarker: Marker | undefined;

  fitPoints(
    lonLats: [number, number][],
    bearing?: number,
    padding = 50,
    pitch = 0,
    ease = true,
  ) {
    if (!this.map || !this.playerMarker) {
      console.warn("tried to view points but map/marker hasn't loaded");
      return;
    }

    const extent = getExtent([
      ...lonLats,
      this.playerMarker.getLngLat().toArray(),
    ]);
    const sw = [extent[0], extent[1]] as [number, number];
    const ne = [extent[2], extent[3]] as [number, number];
    this.map.fitBounds([sw, ne], {
      duration: 500,
      linear: ease,
      pitch: pitch,
      bearing: bearing,
      padding: padding,
    });
    //this.map.fitBounds([sw, ne], {
    //  curve: 1,
    //  //center: this.playerMarker.getLngLat(),
    //  pitch: 0,
    //  bearing: 0,
    //  padding: { left: 100, bottom: 200, right: 100 },
    //});
  }

  // https://stackoverflow.com/a/79221173
  // FitBounds doesn't take into account bearing and pitch,
  // this method adjusts the bounds to the bearing.
  findRotatedBoundingBox = (points: [number, number][], bearing: number) => {
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    // Rotate a point [lng, lat] around a given origin by an angle in radians
    const rotatePoint = (
      [lng, lat]: [number, number],
      angle: number,
      origin: [number, number],
    ) => {
      const cosTheta = Math.cos(angle);
      const sinTheta = Math.sin(angle);
      const translatedLng = lng - origin[0];
      const translatedLat = lat - origin[1];
      const xRot = translatedLng * cosTheta - translatedLat * sinTheta;
      const yRot = translatedLng * sinTheta + translatedLat * cosTheta;
      return [xRot, yRot] as [number, number];
    };
    // Find centroid from an array of points
    const findCentroid = (points: [number, number][]) => {
      return points
        .reduce(
          ([sumLng, sumLat], [lng, lat]) => [sumLng + lng, sumLat + lat],
          [0, 0],
        )
        .map(sum => sum / points.length) as [number, number];
    };

    const bearingRadians = toRadians(bearing);
    const centroid = findCentroid(points);
    // Rotate all points to the rotated coordinate space using the centroid
    const rotatedPoints = [];
    for (const point of points) {
      if (typeof point !== typeof [0, 0]) continue;
      if (point.length !== 2) continue;
      if (typeof point[0] !== 'number' || typeof point[1] !== 'number')
        continue;
      rotatedPoints.push(rotatePoint(point, bearingRadians, centroid));
    }
    // Find bounding box in rotated space
    const rotatedBounds = getExtent(rotatedPoints);
    const bounds = [
      [rotatedBounds[0], rotatedBounds[1]],
      [rotatedBounds[2], rotatedBounds[3]],
    ] as [[number, number], [number, number]];
    // Add centroid to get the final bounds
    // This is equivalent to rotating the bounding box around the centroid
    bounds[0][0] += centroid[0];
    bounds[0][1] += centroid[1];
    bounds[1][0] += centroid[0];
    bounds[1][1] += centroid[1];
    //const bounds = rotatedBounds.map((v, i) => v + centroid[i % 2]) as unknown as [[number, number], [number, number]];

    return bounds;
  };

  onMapLoad(map: MapRef, player: Marker) {
    Preconditions.checkState(this.map == null);
    Preconditions.checkState(this.playerMarker == null);
    this.map = map;
    this.playerMarker = player;
  }

  onMapDragStart(store: AppStore) {
    store.cameraMode = CameraMode.FREE;
  }

  setFollow(store: AppStore) {
    store.cameraMode = CameraMode.FOLLOW;
  }

  startRouteFlow(store: AppStore) {
    store.showNavSheet = true;
  }

  hideNavSheet(store: AppStore) {
    console.log('hide nav sheet');
    store.showNavSheet = false;
  }

  setDestinationNodeUid(store: AppStore, toNodeUid: string, client: AppClient) {
    void client.previewRoutes.query({ toNodeUid }).then(
      action(([firstRoute]) => {
        if (!firstRoute) {
          console.warn('could not find route to', toNodeUid);
        }
        this.setActiveRoute(store, firstRoute, client);
      }),
    );
  }

  setActiveRoute(store: AppStore, route: Route | undefined, client: AppClient) {
    // optimistically set route
    store.activeRoute = route;
    this.renderActiveRoute(route);
    void client.setActiveRoute.mutate(route?.segments.map(s => s.key));
  }

  startListening(store: AppStore, client: AppClient) {
    let prevPosition: Position = [0, 0];
    let currPosition: Position = [0, 0];
    const markerPosition: Position = [0, 0];
    let prevBearing = 0;
    let currBearing = 0;
    let markerBearing = 0;
    console.log('subscribing');
    client.onRouteUpdate.subscribe(undefined, {
      onData: action(maybeRoute => {
        store.activeRoute = maybeRoute;
        this.renderActiveRoute(maybeRoute);
      }),
    });

    client.onDirectionUpdate.subscribe(undefined, {
      onData: action(maybeDir => {
        if (maybeDir) {
          console.log('distance to', maybeDir.distanceMeters);
          if (maybeDir.distanceMeters === 0) {
            console.log(maybeDir);
          }
        }
        if (maybeDir && maybeDir.distanceMeters >= 500) {
          maybeDir = { ...maybeDir, laneHint: undefined };
        }
        store.activeRouteDirection = maybeDir;
      }),
    });

    client.onPositionUpdate.subscribe(undefined, {
      // HACK wrap this in an `action`, even though no observable state is being
      // written to, just to squash the mobx warnings about accessing observable
      // `store` properties in a non-reactive context.
      onData: action(gameState => {
        const { map, playerMarker } = this;
        if (!map || !playerMarker) {
          return;
        }

        const { speedMph, position: center, bearing } = gameState;
        if (prevPosition.every(v => !v)) {
          map.setCenter(center);
        }
        prevPosition = currPosition;
        currPosition = center;
        prevBearing = currBearing;
        currBearing = bearing;

        const cameraBearing = bearing;

        const active_route = store.activeRoute;
        const closest = active_route
          ? active_route.segments
              .flatMap(s => s.lonLats)
              .reduce((prev, curr) =>
                (curr[0] - center[0]) ** 2 + (curr[1] - center[1]) ** 2 <
                (prev[0] - center[0]) ** 2 + (prev[1] - center[1]) ** 2
                  ? curr
                  : prev,
              )
          : undefined;
        const closestDistance = closest
          ? Math.sqrt(
              (closest[0] - center[0]) ** 2 + (closest[1] - center[1]) ** 2,
            )
          : undefined;

        let idx = undefined;
        if (closest && closestDistance && closestDistance < 0.1) {
          // ~10km
          idx = active_route?.segments
            .flatMap(s => s.lonLats)
            .findIndex(ll => ll[0] === closest[0] && ll[1] === closest[1]);

          if (idx && store.cameraMode === CameraMode.FOLLOW) {
            // Switch to route from follow if we're on a route
            store.cameraMode = CameraMode.ROUTE;
          } else if (!idx && store.cameraMode === CameraMode.ROUTE) {
            // Fallback to follow if route is not found
            store.cameraMode = CameraMode.FOLLOW;
          }
        }

        switch (store.cameraMode) {
          case CameraMode.FREE:
            playerMarker.setLngLat(center);
            playerMarker.setRotation(bearing);
            break;
          case CameraMode.ROUTE: {
            // HACK: There should be a better way to do this somewhere,
            // I just haven't found it yet.
            // - Tumppi066

            // Rotate the camera to point along the route.
            let routeCamera = false;
            if (idx) {
              const lookAhead = Math.round(speedMph * 0.4 + 4);
              const nextSegments = active_route?.segments
                .flatMap(s => s.lonLats)
                .slice(idx, idx + lookAhead);

              if (nextSegments && nextSegments.length >= 2) {
                routeCamera = true;
                const { pitch: newPitch } = toCameraOptions(
                  center,
                  cameraBearing,
                  speedMph,
                );

                nextSegments.push(currPosition);
                const bounds = this.findRotatedBoundingBox(
                  nextSegments,
                  cameraBearing,
                );

                map.fitBounds(bounds, {
                  duration: 500,
                  linear: true,
                  pitch: newPitch,
                  bearing: cameraBearing,
                  padding: {
                    bottom: 100,
                    left: store.showNavSheet ? 440 : 50,
                    right: 50,
                  },
                  maxZoom: 13,
                  minZoom: 10,
                  easing: t => {
                    // HACK update marker here
                    markerPosition[0] =
                      prevPosition[0] + t * (currPosition[0] - prevPosition[0]);
                    markerPosition[1] =
                      prevPosition[1] + t * (currPosition[1] - prevPosition[1]);
                    markerBearing =
                      prevBearing +
                      t * calculateDelta(prevBearing, currBearing);

                    playerMarker.setLngLat(markerPosition);
                    playerMarker.setRotation(markerBearing);
                    return t;
                  },
                });
              }
              if (!routeCamera) {
                // Fallthrough to FOLLOW
                store.cameraMode = CameraMode.FOLLOW;
              }
            }
            break;
          }
          case CameraMode.FOLLOW:
            map.easeTo({
              ...toCameraOptions(center, cameraBearing, speedMph),
              duration: 500,
              padding: { left: store.showNavSheet ? 440 : 0, top: 400 },
              easing: t => {
                // HACK update marker here
                markerPosition[0] =
                  prevPosition[0] + t * (currPosition[0] - prevPosition[0]);
                markerPosition[1] =
                  prevPosition[1] + t * (currPosition[1] - prevPosition[1]);
                markerBearing =
                  prevBearing + t * calculateDelta(prevBearing, currBearing);

                playerMarker.setLngLat(markerPosition);
                playerMarker.setRotation(markerBearing);
                return t;
              },
            });
            break;
          default:
            throw new UnreachableError(store.cameraMode);
        }
      }),
    });

    client.onTrailerUpdate.subscribe(undefined, {
      onData: action(
        maybeTrailerPos => (store.trailerPoint = maybeTrailerPos?.position),
      ),
    });

    client.onThemeModeUpdate.subscribe(undefined, {
      onData: action(themeMode => {
        store.themeMode = themeMode;
        // HACK is this the best way to change theme mode, outside of a React
        // component?
        const htmlElement = document.documentElement;
        htmlElement.setAttribute('data-joy-color-scheme', themeMode);
        htmlElement.setAttribute('data-mui-color-scheme', themeMode);
      }),
    });
  }

  renderActiveRoute(maybeRoute: Route | undefined) {
    const { map } = this;
    if (!map) {
      // TODO what if map becomes defined after onData fires?
      return;
    }

    const routeSource = assertExists(
      map.getSource<GeoJSONSource>('activeRoute'),
    );
    if (!maybeRoute) {
      routeSource.setData(emptyFeatureCollection);
      return;
    }

    console.log('setting route data', maybeRoute);
    routeSource.setData(toFeatureCollection(maybeRoute));
    // active route layer may have been hidden
    // note: setting paint property by getting a reference to the style layer
    // with react-map-gl apis, then calling setpaintproperty on the style layer,
    // does *not* work.
    map.getMap().setLayoutProperty('activeRouteLayer', 'visibility', 'visible');
  }

  renderRoutePreview(
    maybeRoute: Route,
    options: {
      highlight: boolean;
      index: number;
    },
  ) {
    const { map } = this;
    if (!map) {
      // TODO what if map becomes defined after onData fires?
      return;
    }

    console.log('rendering route preview');
    const routeSource = assertExists(
      map.getSource<GeoJSONSource>(`previewRoute-${options.index}`),
    );
    if (!maybeRoute) {
      routeSource.setData(emptyFeatureCollection);
      return;
    }

    routeSource.setData(toFeatureCollection(maybeRoute));
    // note: setting paint property by getting a reference to the style layer
    // with react-map-gl apis, then calling setpaintproperty on the style layer,
    // does *not* work.
    map
      .getMap()
      .setPaintProperty(
        `previewRouteLayer-${options.index}`,
        'line-opacity',
        options.highlight ? 1 : 0.25,
      )
      .setLayoutProperty('activeRouteLayer', 'visibility', 'none');
  }
}

const emptyFeatureCollection: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
} as const;

function toFeatureCollection(route: Route): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: route.segments.flatMap(segment => segment.lonLats),
        },
        properties: null,
      },
    ],
  };
}

function calculateDelta(currBearing: number, nextBearing: number): number {
  const normalizedCurr = currBearing % 360;
  const normalizedNext = nextBearing > 0 ? nextBearing : nextBearing + 360;
  let delta = normalizedNext - normalizedCurr;
  if (delta > 180) {
    delta -= 360;
  }
  return delta;
}

function toCameraOptions(center: Position, bearing: number, speedMph: number) {
  let zoom;
  let pitch;
  if (speedMph > 60) {
    zoom = 11;
    pitch = 25;
  } else if (speedMph > 40) {
    zoom = 12;
    pitch = 20;
  } else if (speedMph > 10) {
    zoom = 12.5;
    pitch = 15;
  } else {
    zoom = 14;
    pitch = 10;
  }
  return {
    center,
    bearing,
    zoom,
    pitch,
  };
}
