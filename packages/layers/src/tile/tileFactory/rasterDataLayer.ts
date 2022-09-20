import BaseLayer from '../../core/BaseLayer';
import { IRasterLayerStyleOptions } from '../../core/interface';
import RasterModel from '../../raster/models/rasterTile';

export default class RasterTiffLayer extends BaseLayer<
  Partial<IRasterLayerStyleOptions>
> {
  public type: string = this.layerType as string;
  public buildModels() {
    const model = this.getModelType();
    this.layerModel = new model(this);
    this.layerModel.initModels((models) => {
      this.models = models;
      this.emit('modelLoaded', null);
      this.layerService.throttleRenderLayers();
    });
  }

  public rebuildModels() {
    this.layerModel.buildModels((models) => {
      this.models = models;
      this.emit('modelLoaded', null);
    });
  }

  protected getModelType() {
    return RasterModel;
  }
  protected getConfigSchema() {
    return {
      properties: {
        opacity: {
          type: 'number',
          minimum: 0,
          maximum: 1,
        },
      },
    };
  }

  protected getDefaultConfig() {
    return {};
  }
}
