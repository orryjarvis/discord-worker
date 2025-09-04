export interface ICommandInput {}
export interface ICommandOutput {}

export interface ICommandHandler<I extends ICommandInput, O extends ICommandOutput> {
  commandId: string;
  handle(interaction: I): Promise<O>;
}
