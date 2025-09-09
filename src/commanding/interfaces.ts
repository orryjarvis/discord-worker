export interface ICommandInput {}
export interface ICommandOutput {}

export interface ICommandHandler<Req, Res> {
  handle(interaction: Req): Promise<Res>;
}

export interface ICommand {
  commandId: string;
  execute(input: ICommandInput): Promise<ICommandOutput>;
}

export interface ICommandParser<Req, Res> {
  parse(interaction: Req): ICommandInput;
  toResponse(result: ICommandOutput): Res;
}
