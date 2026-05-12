from deno_sandbox import DenoDeploy

def main():
  sdk = DenoDeploy()

  with sdk.sandbox.create() as sandbox:
    process = sandbox.spawn("ls", args=["-lh"])
    process.wait()

if __name__ == '__main__':
  main()
