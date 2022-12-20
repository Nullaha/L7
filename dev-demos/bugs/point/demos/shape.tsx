// @ts-ignore
import { PointLayer, Scene,Popup } from '@antv/l7';
// @ts-ignore
import { GaodeMap, Mapbox } from '@antv/l7-maps';
import React, { useEffect } from 'react';
  
export default () => {
  // @ts-ignore
    useEffect( async () => {
      const response = await fetch(
        'https://gw.alipayobjects.com/os/basement_prod/893d1d5f-11d9-45f3-8322-ee9140d288ae.json',
      );
      let shapeType = '01'
      const scene = new Scene({
        id: 'map',
        map: new GaodeMap({
          center: [121.4, 31.258134],
          zoom: 14,
          pitch: 0,
          style: 'normal',
          doubleClickZoom:false,
        }),
      });
      scene.addImage(
        '00',
        'https://gw.alipayobjects.com/mdn/rms_fcd5b3/afts/img/A*g8cUQ7pPT9YAAAAAAAAAAAAAARQnAQ',
      );
      scene.addImage(
        '01',
        'https://gw.alipayobjects.com/mdn/rms_fcd5b3/afts/img/A*LTcXTLBM7kYAAAAAAAAAAAAAARQnAQ',
      );
      scene.addImage(
        '02',
        'https://gw.alipayobjects.com/zos/bmw-prod/904d047a-16a5-461b-a921-98fa537fc04a.svg',
      );
      const data = await response.json();
      const newData = data.map((item: any) => {
        item.type = ['00', '01', '02'][Math.floor(Math.random() * 3)];
        return item;
      });
      const imageLayer = new PointLayer({
        autoFit:false
      })
        .source(newData, {
          parser: {
            type: 'json',
            x: 'longitude',
            y: 'latitude',
          },
        })
        .shape('type', (v: any) => {
          return shapeType;
        })
        .active(false)
        .size(20);
      scene.addLayer(imageLayer);
      setTimeout(()=>{
      shapeType = '02';
    //   imageLayer.shape('type', (v: any) => {
    //     console.log(1111,shapeType)
    //     return shapeType;
    //   })
    imageLayer.shape('02');
    //   scene.render()

      },2000)
          
    }, []);
    return (
      <div
        id="map"
        style={{
          height: '500px',
          position: 'relative',
        }}
      />
    );
  };
  