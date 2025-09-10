export type ICommandInput = Record<string, unknown>;
export type ICommandOutput = unknown;

export interface ICommandHandler<Req, Res> {
  handle(request: Req): Promise<Res>;
}

export interface ICommand {
  commandId: string;
  execute(input: ICommandInput): Promise<ICommandOutput>;
}

export interface ICommandParser<Req, Res> {
  parse(interaction: Req): ICommandInput;
  toResponse(result: ICommandOutput): Res;
}
