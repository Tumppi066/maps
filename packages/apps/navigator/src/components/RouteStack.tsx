import { Box, Stack } from '@mui/joy';
import { Collapse, Slide } from '@mui/material';
import { useMeasure } from '@uidotdev/usehooks';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';

export const RouteStack = (props: {
  Guidance: () => ReactElement;
  onRouteEndClick: () => void;
  distanceMeters?: number;
  minutes?: number;
}) => {
  const { Guidance, onRouteEndClick } = props;
  const [stackRef, { height: stackHeight }] = useMeasure();
  //const [guidanceRef, { height: guidanceHeight }] = useMeasure();
  //const [routeControlsRef, { height: routeControlsHeight }] = useMeasure();
  const [expanded, setExpanded] = useState(false);
  const toggleDisclosure = useCallback(
    () => setExpanded(!expanded),
    [expanded],
  );
  const handleRouteEndClick = () => {
    onRouteEndClick();
    setExpanded(false);
  };
  // HACK until there's a nice way to figure this out for real.
  const needsExpanding = (stackHeight ?? 0) < 520;

  return (
    <Box ref={stackRef} height={'100%'}>
      <Stack
        height={'100%'}
        style={{
          transition: 'all 0.5s ease',
        }}
        justifyContent={'space-between'}
      >
        <Box sx={{ pointerEvents: 'auto' }}>
          <Slide in={!needsExpanding || !expanded} appear={false}>
            <Box /* ref={guidanceRef} */>
              <Collapse in={!needsExpanding || !expanded} appear={false}>
                <Guidance />
              </Collapse>
            </Box>
          </Slide>
        </Box>
        <Box
          //ref={routeControlsRef}
          sx={{
            pointerEvents: 'auto',
            maxHeight: `calc(${stackHeight}px - 1em)`,
          }}
        >
          {/* I've made these work, but I didn't like how it felt with ETS2LA so it's disabled for now.
          <RouteControls
            summary={{ minutes: props.minutes ? props.minutes : 0, distanceMeters: props.distanceMeters ? props.distanceMeters : 0 }}
            expanded={expanded}
            onDisclosureClick={toggleDisclosure}
            onRouteEndClick={handleRouteEndClick}
          />
          */}
        </Box>
      </Stack>
    </Box>
  );
};
